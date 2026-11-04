import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { recordLoginFailure, accountLockoutKey, checkAccountLockout } from "@/lib/login-lockout";
import { ResetStaffPasswordError, resetStaffPassword } from "./reset-staff-password";

// Integration test against the real database, with fixture accounts only.

const FIXTURE_TAG = `ResetStaffPasswordFixture${Date.now()}`.toLowerCase();
let superAdminId: string;
let staffId: string;
let memberUserId: string;
let memberId: string;

beforeAll(async () => {
  const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
  superAdminId = (
    await prisma.user.create({ data: { email: `${FIXTURE_TAG}-admin@example.invalid`, roles: { create: { role: "SUPER_ADMIN" } } } })
  ).id;
  staffId = (
    await prisma.user.create({
      data: {
        email: `${FIXTURE_TAG}-staff@example.invalid`,
        passwordHash: await bcrypt.hash("old-password-123", 4),
        roles: { create: { role: "SUPER_ADMIN" } },
      },
    })
  ).id;
  memberId = (
    await prisma.member.create({
      data: { surname: FIXTURE_TAG, firstName: "Member", gender: "MALE", status: "ACTIVE", source: "ADMIN_ENTRY", wingId: wing.id },
    })
  ).id;
  memberUserId = (await prisma.user.create({ data: { email: `${FIXTURE_TAG}-member@example.invalid`, memberId } })).id;
});

afterAll(async () => {
  const ids = [superAdminId, staffId, memberUserId];
  await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.rateLimitCounter.deleteMany({ where: { key: { in: ids.map(accountLockoutKey) } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.member.delete({ where: { id: memberId } });
  await prisma.$disconnect();
});

const superAdmin = () => ({ id: superAdminId, roles: ["SUPER_ADMIN" as const] });

describe("resetStaffPassword", () => {
  it("replaces the password with a temporary one, forces a change and clears a lockout", async () => {
    for (let i = 0; i < 5; i++) await recordLoginFailure(accountLockoutKey(staffId));
    expect((await checkAccountLockout(accountLockoutKey(staffId))).locked).toBe(true);

    const { temporaryPassword } = await prisma.$transaction((tx) => resetStaffPassword(tx, staffId, superAdmin()));

    const user = await prisma.user.findUniqueOrThrow({ where: { id: staffId } });
    expect(await bcrypt.compare(temporaryPassword, user.passwordHash!)).toBe(true);
    expect(await bcrypt.compare("old-password-123", user.passwordHash!)).toBe(false);
    expect(user.mustChangePassword).toBe(true);
    expect(user.temporaryPasswordIssuedById).toBe(superAdminId);
    expect((await checkAccountLockout(accountLockoutKey(staffId))).locked).toBe(false);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: staffId, action: "user.credentials_reissued" } });
    expect(JSON.stringify(audit)).not.toContain(temporaryPassword);
  });

  it("refuses anyone but a super admin, their own account, and a member's account", async () => {
    await expect(
      prisma.$transaction((tx) => resetStaffPassword(tx, staffId, { id: superAdminId, roles: ["WING_ADMIN"] })),
    ).rejects.toBeInstanceOf(ResetStaffPasswordError);
    await expect(prisma.$transaction((tx) => resetStaffPassword(tx, superAdminId, superAdmin()))).rejects.toThrow(
      "your own password",
    );
    await expect(prisma.$transaction((tx) => resetStaffPassword(tx, memberUserId, superAdmin()))).rejects.toThrow(
      "member's account",
    );
  });
});
