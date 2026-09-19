import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { CreateStaffUserError, createStaffUser } from "./create-staff-user";

// Integration test against the real database. The hard rule this is
// here to prove is not just that the code compiles but that the
// plaintext temporary password genuinely never reaches the database in
// any column, including the audit log's before/after JSON, the same
// property lib/members/issue-login.test.ts proves for a member.

const FIXTURE_TAG = `CreateStaffFixture${Date.now()}`;
const createdUserIds: string[] = [];

function fixtureEmail(suffix: string): string {
  return `${FIXTURE_TAG}-${suffix}@ahl-league.test`;
}

describe("createStaffUser", () => {
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
    await prisma.userWingAssignment.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it("creates a wing scoped account with its role and wing assignment", async () => {
    const result = await prisma.$transaction((tx) =>
      createStaffUser(tx, { email: fixtureEmail("wingadmin"), role: "WING_ADMIN", wingId }, actorId),
    );
    createdUserIds.push(result.userId);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { roles: true, wingAssignments: true },
    });
    expect(user.memberId).toBeNull();
    expect(user.mustChangePassword).toBe(true);
    expect(user.roles.map((r) => r.role)).toEqual(["WING_ADMIN"]);
    expect(user.wingAssignments.map((w) => w.wingId)).toEqual([wingId]);
    expect(await bcrypt.compare(result.temporaryPassword, user.passwordHash!)).toBe(true);
  });

  it("creates an all-wings role with no wing assignment", async () => {
    const result = await prisma.$transaction((tx) =>
      createStaffUser(tx, { email: fixtureEmail("finance"), role: "FINANCE_OFFICER" }, actorId),
    );
    createdUserIds.push(result.userId);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { wingAssignments: true },
    });
    expect(user.wingAssignments).toHaveLength(0);
  });

  it("refuses a wing scoped role given no wing", async () => {
    await expect(
      prisma.$transaction((tx) => createStaffUser(tx, { email: fixtureEmail("nowing"), role: "ATTENDANCE_OFFICER" }, actorId)),
    ).rejects.toBeInstanceOf(CreateStaffUserError);
  });

  it("refuses a second account with the same email", async () => {
    const email = fixtureEmail("dupe");
    const first = await prisma.$transaction((tx) =>
      createStaffUser(tx, { email, role: "CONTENT_EDITOR" }, actorId),
    );
    createdUserIds.push(first.userId);

    await expect(
      prisma.$transaction((tx) => createStaffUser(tx, { email, role: "CONTENT_EDITOR" }, actorId)),
    ).rejects.toBeInstanceOf(CreateStaffUserError);
  });

  it("never writes the plaintext temporary password anywhere in the audit log", async () => {
    const result = await prisma.$transaction((tx) =>
      createStaffUser(tx, { email: fixtureEmail("audit"), role: "CHARITY_OFFICER" }, actorId),
    );
    createdUserIds.push(result.userId);

    const entries = await prisma.auditLog.findMany({ where: { entity: "User", entityId: result.userId } });
    for (const entry of entries) {
      expect(JSON.stringify(entry.before)).not.toContain(result.temporaryPassword);
      expect(JSON.stringify(entry.after)).not.toContain(result.temporaryPassword);
    }
  });
});
