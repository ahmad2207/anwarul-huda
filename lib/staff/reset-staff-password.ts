import type { Prisma, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeAudit } from "@/lib/audit";
import { generateTemporaryPassword } from "@/lib/credentials";
import { accountLockoutKey } from "@/lib/login-lockout";

const PASSWORD_HASH_ROUNDS = 12;

export class ResetStaffPasswordError extends Error {}

/**
 * Gives a staff member who cannot sign in a new temporary password, the
 * staff counterpart of a member's login reissue (lib/members/issue-login.ts),
 * with the same credential pattern: generated here, hashed before it
 * touches the database, returned to the caller exactly once, and a
 * password change forced at the next sign-in.
 *
 * Super admins only, and never on their own account. A reset hands the
 * person doing it a working password for the account, so letting a wing
 * administrator do it, as staff creation does, would let one take over a
 * super admin's account. A super admin changes their own password from
 * the change-password page instead.
 *
 * Any lockout on the account is cleared, so the new password works at
 * once rather than after the lockout window.
 */
export async function resetStaffPassword(
  tx: Prisma.TransactionClient,
  targetUserId: string,
  actor: { id: string; roles: RoleName[] },
): Promise<{ email: string | null; temporaryPassword: string }> {
  if (!actor.roles.includes("SUPER_ADMIN")) {
    throw new ResetStaffPasswordError("Only a super administrator can reset a staff password.");
  }
  if (targetUserId === actor.id) {
    throw new ResetStaffPasswordError("Change your own password from your account instead.");
  }

  const target = await tx.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, memberId: true, mustChangePassword: true },
  });
  if (!target) {
    throw new ResetStaffPasswordError("That account could not be found.");
  }
  if (target.memberId) {
    throw new ResetStaffPasswordError("This is a member's account. Reissue their login from their member record.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
  const now = new Date();

  await tx.user.update({
    where: { id: target.id },
    data: {
      passwordHash,
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
      temporaryPasswordIssuedAt: now,
      temporaryPasswordIssuedById: actor.id,
    },
  });
  await tx.rateLimitCounter.deleteMany({ where: { key: accountLockoutKey(target.id) } });

  // Never the password: only that a reset happened, by whom and when.
  await writeAudit(
    {
      actorId: actor.id,
      action: "user.credentials_reissued",
      entity: "User",
      entityId: target.id,
      before: { mustChangePassword: target.mustChangePassword },
      after: { mustChangePassword: true, temporaryPasswordIssuedAt: now.toISOString() },
    },
    tx,
  );

  return { email: target.email, temporaryPassword };
}
