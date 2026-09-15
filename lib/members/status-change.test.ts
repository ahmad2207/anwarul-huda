import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyMemberStatusChange } from "./status-change";

// Integration test against the real local Postgres database. Covers the
// Phase 7 security pass finding: a member set to INACTIVE or DECEASED
// kept their linked login active, and neither that write nor the
// original approval's user write had its own audit entry.

const FIXTURE_TAG = `StatusChangeFixture${Date.now()}`;
const createdUserIds: string[] = [];

describe("applyMemberStatusChange", () => {
  let actorId: string;
  let wingId: string;

  beforeAll(async () => {
    const actor = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    actorId = actor.id;
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    wingId = wing.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entity: "User", entityId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.member.deleteMany({ where: { surname: FIXTURE_TAG } });
    await prisma.$disconnect();
  });

  async function makeMemberWithUser(phoneSuffix: string, isActive: boolean) {
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Member",
        gender: "MALE",
        phone: `+234805555${phoneSuffix}`,
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId,
      },
    });
    const user = await prisma.user.create({
      data: { phone: member.phone, isActive, memberId: member.id },
    });
    createdUserIds.push(user.id);
    return { member, user };
  }

  it("deactivates the linked login when the member becomes INACTIVE", async () => {
    const { member } = await makeMemberWithUser("0001", true);

    await prisma.$transaction((tx) =>
      applyMemberStatusChange(tx, member, {
        newStatus: "INACTIVE",
        reason: "No longer attending",
        effectiveDate: new Date(),
        actorId,
      }),
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { memberId: member.id } });
    expect(user.isActive).toBe(false);

    const audit = await prisma.auditLog.findFirst({
      where: { entity: "User", entityId: user.id, action: "user.deactivated" },
    });
    expect(audit).not.toBeNull();
  });

  it("deactivates the linked login when the member becomes DECEASED", async () => {
    const { member } = await makeMemberWithUser("0002", true);

    await prisma.$transaction((tx) =>
      applyMemberStatusChange(tx, member, {
        newStatus: "DECEASED",
        reason: "Passed away",
        effectiveDate: new Date(),
        actorId,
      }),
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { memberId: member.id } });
    expect(user.isActive).toBe(false);
  });

  it("reactivates the linked login when the member is restored to ACTIVE", async () => {
    const { member } = await makeMemberWithUser("0003", false);

    await prisma.$transaction((tx) =>
      applyMemberStatusChange(tx, member, {
        newStatus: "ACTIVE",
        reason: "Reinstated",
        effectiveDate: new Date(),
        actorId,
      }),
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { memberId: member.id } });
    expect(user.isActive).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { entity: "User", entityId: user.id, action: "user.reactivated" },
    });
    expect(audit).not.toBeNull();
  });

  it("leaves login access untouched for a status that is not a deactivation", async () => {
    const { member, user } = await makeMemberWithUser("0004", true);

    await prisma.$transaction((tx) =>
      applyMemberStatusChange(tx, member, {
        newStatus: "OCCASIONAL",
        reason: "Attends occasionally now",
        effectiveDate: new Date(),
        actorId,
      }),
    );

    const reloaded = await prisma.user.findUniqueOrThrow({ where: { memberId: member.id } });
    expect(reloaded.isActive).toBe(true); // unchanged

    const audit = await prisma.auditLog.findFirst({ where: { entity: "User", entityId: user.id } });
    expect(audit).toBeNull(); // nothing written for the user, since nothing changed
  });

  it("does nothing to any user, and does not throw, for a member with no linked account", async () => {
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "NoLogin",
        gender: "FEMALE",
        phone: "+2348055550005",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId,
      },
    });

    await expect(
      prisma.$transaction((tx) =>
        applyMemberStatusChange(tx, member, {
          newStatus: "INACTIVE",
          reason: "No longer attending",
          effectiveDate: new Date(),
          actorId,
        }),
      ),
    ).resolves.not.toThrow();
  });

  it("always audits the member's own status change", async () => {
    const { member } = await makeMemberWithUser("0006", true);

    const updated = await prisma.$transaction((tx) =>
      applyMemberStatusChange(tx, member, {
        newStatus: "INACTIVE",
        reason: "Testing member audit",
        effectiveDate: new Date(),
        actorId,
      }),
    );

    const audit = await prisma.auditLog.findFirst({
      where: { entity: "Member", entityId: updated.id, action: "member.status_changed" },
    });
    expect(audit).not.toBeNull();
  });
});
