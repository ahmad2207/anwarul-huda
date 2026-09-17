import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { IssueLoginError, issueLoginForMember } from "./issue-login";

// Integration test against the real local Postgres database, the same
// way lib/members/status-change.test.ts exercises its own transaction.
// The hard rule this is here to prove is not just that the code compiles
// but that the plaintext temporary password genuinely never reaches the
// database in any column, including the audit log's before/after JSON.

const FIXTURE_TAG = `IssueLoginFixture${Date.now()}`;
const createdMemberIds: string[] = [];

describe("issueLoginForMember", () => {
  let actorId: string;
  let wingId: string;

  beforeAll(async () => {
    const actor = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    actorId = actor.id;
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    wingId = wing.id;
  });

  afterAll(async () => {
    // Every user this test created is linked to a fixture member, so that
    // link is what scopes the cleanup, rather than deleting by entity
    // "User" alone, which would sweep up unrelated audit history too.
    const users = await prisma.user.findMany({ where: { member: { surname: FIXTURE_TAG } } });
    const userIds = users.map((user) => user.id);
    await prisma.auditLog.deleteMany({ where: { entity: "User", entityId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.member.deleteMany({ where: { id: { in: createdMemberIds } } });
    await prisma.$disconnect();
  });

  // A fake year (9200s) keeps these member numbers well away from any
  // real sequence generateMemberNumber would ever issue, the same way
  // lib/member-number.test.ts's fixture years do.
  async function makeMember(sequenceSuffix: string, withUser: boolean) {
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Member",
        gender: "MALE",
        memberNumber: `AHL/M/9200/${sequenceSuffix}`,
        status: "ACTIVE",
        source: "CSV_IMPORT",
        isRecordIncomplete: true,
        wingId,
      },
      include: { user: true },
    });
    createdMemberIds.push(member.id);
    if (!withUser) return member;

    const user = await prisma.user.create({
      data: {
        passwordHash: await bcrypt.hash("some-earlier-password", 4),
        isActive: true,
        memberId: member.id,
      },
    });
    return { ...member, user };
  }

  it("creates a new login on first issue, with mustChangePassword true, no phone required", async () => {
    const member = await makeMember("0001", false);
    expect(member.phone).toBeNull(); // the point of the whole change: this is not a blocker

    const result = await prisma.$transaction((tx) => issueLoginForMember(tx, member, actorId));

    expect(result.isReissue).toBe(false);
    expect(result.temporaryPassword).toHaveLength(10);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.mustChangePassword).toBe(true);
    expect(user.temporaryPasswordIssuedById).toBe(actorId);
    expect(user.temporaryPasswordIssuedAt).not.toBeNull();

    const passwordMatches = await bcrypt.compare(result.temporaryPassword, user.passwordHash!);
    expect(passwordMatches).toBe(true);
  });

  it("audits a first issue as user.credentials_issued with no before state", async () => {
    const member = await makeMember("0002", false);
    const result = await prisma.$transaction((tx) => issueLoginForMember(tx, member, actorId));

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "User", entityId: result.userId, action: "user.credentials_issued" },
    });
    expect(audit.before).toBeNull();
  });

  it("never writes the plaintext temporary password anywhere in the audit log", async () => {
    const member = await makeMember("0003", false);
    const result = await prisma.$transaction((tx) => issueLoginForMember(tx, member, actorId));

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "User", entityId: result.userId, action: "user.credentials_issued" },
    });
    const serialized = JSON.stringify(audit);
    expect(serialized).not.toContain(result.temporaryPassword);

    // Also true of the User row itself: only its bcrypt hash is stored,
    // never a column holding the value this test just generated.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(JSON.stringify(user)).not.toContain(result.temporaryPassword);
  });

  it("invalidates the previous temporary password on reissue", async () => {
    const member = await makeMember("0004", true);
    const firstHash = member.user!.passwordHash!;

    const result = await prisma.$transaction((tx) => issueLoginForMember(tx, member, actorId));

    expect(result.isReissue).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.passwordHash).not.toBe(firstHash);

    const oldStillMatches = await bcrypt.compare("some-earlier-password", user.passwordHash!);
    expect(oldStillMatches).toBe(false);

    const newMatches = await bcrypt.compare(result.temporaryPassword, user.passwordHash!);
    expect(newMatches).toBe(true);
  });

  it("audits a reissue separately from a first issue, carrying the prior mustChangePassword state", async () => {
    const member = await makeMember("0005", true);
    // This fixture's existing user was created with mustChangePassword at
    // its default, false, simulating an account that had already
    // completed its first change before being reissued a new one.
    const result = await prisma.$transaction((tx) => issueLoginForMember(tx, member, actorId));

    expect(result.isReissue).toBe(true);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "User", entityId: result.userId, action: "user.credentials_reissued" },
    });
    expect(audit.before).toEqual({ mustChangePassword: false });

    const issuedAudit = await prisma.auditLog.findFirst({
      where: { entity: "User", entityId: result.userId, action: "user.credentials_issued" },
    });
    expect(issuedAudit).toBeNull(); // a reissue is never also logged as a first issue
  });

  it("carries over an existing phone on file without requiring one", async () => {
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "HasPhoneToo",
        gender: "FEMALE",
        memberNumber: "AHL/M/9200/0006",
        phone: "+2348055559999",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId,
      },
      include: { user: true },
    });
    createdMemberIds.push(member.id);

    const result = await prisma.$transaction((tx) => issueLoginForMember(tx, member, actorId));
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.phone).toBe("+2348055559999");
  });

  it("refuses to issue a login for a member with no member number yet, without creating a user", async () => {
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "NotApprovedYet",
        gender: "FEMALE",
        status: "PENDING",
        source: "SELF_REGISTRATION",
        wingId,
      },
      include: { user: true },
    });
    createdMemberIds.push(member.id);

    await expect(prisma.$transaction((tx) => issueLoginForMember(tx, member, actorId))).rejects.toThrow(
      IssueLoginError,
    );

    const user = await prisma.user.findUnique({ where: { memberId: member.id } });
    expect(user).toBeNull();
  });
});
