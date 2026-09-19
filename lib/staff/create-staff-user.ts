import type { Prisma, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeAudit } from "@/lib/audit";
import { generateTemporaryPassword } from "@/lib/credentials";

const PASSWORD_HASH_ROUNDS = 12;

export class CreateStaffUserError extends Error {}

/** Roles that mean something narrower than "every wing" in this app's own authorization.ts, and so need a UserWingAssignment row to mean anything. */
export const WING_SCOPED_ROLES: readonly RoleName[] = ["WING_ADMIN", "ATTENDANCE_OFFICER"];

/** The only roles a WING_ADMIN (not a SUPER_ADMIN) may grant: the two that stay inside their own wing. FINANCE_OFFICER, CHARITY_OFFICER and CONTENT_EDITOR see every wing regardless of any wing assignment, so granting one of those is a super-admin-only action, not something delegable per wing. */
export const WING_ADMIN_CREATABLE_ROLES: readonly RoleName[] = ["WING_ADMIN", "ATTENDANCE_OFFICER"];

export interface CreateStaffUserInput {
  email: string;
  phone?: string;
  role: RoleName;
  /** Required for a WING_SCOPED_ROLES role, ignored otherwise. */
  wingId?: string;
}

export interface CreateStaffUserResult {
  userId: string;
  temporaryPassword: string;
}

/**
 * Creates a staff account (a User with no linked Member) with one role
 * and, for a wing scoped role, one wing assignment. Mirrors
 * lib/members/issue-login.ts's credential pattern exactly: a temporary
 * password generated here, hashed before it touches the database, and
 * returned to the caller exactly once. mustChangePassword forces the
 * change on first login the same way it does for a member.
 */
export async function createStaffUser(
  tx: Prisma.TransactionClient,
  input: CreateStaffUserInput,
  actorId: string,
): Promise<CreateStaffUserResult> {
  const needsWing = WING_SCOPED_ROLES.includes(input.role);
  if (needsWing && !input.wingId) {
    throw new CreateStaffUserError(`${input.role} needs a wing.`);
  }

  const existing = await tx.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new CreateStaffUserError("An account with this email already exists.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
  const now = new Date();

  const user = await tx.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      passwordHash,
      isActive: true,
      mustChangePassword: true,
      temporaryPasswordIssuedAt: now,
      temporaryPasswordIssuedById: actorId,
      roles: { create: { role: input.role } },
      ...(needsWing && input.wingId
        ? { wingAssignments: { create: { wingId: input.wingId } } }
        : {}),
    },
  });

  // Never the password, here or anywhere else: only that an account was
  // created, by whom, with which role and wing.
  await writeAudit(
    {
      actorId,
      action: "user.staff_account_created",
      entity: "User",
      entityId: user.id,
      before: null,
      after: { email: user.email, role: input.role, wingId: needsWing ? input.wingId : null },
    },
    tx,
  );

  return { userId: user.id, temporaryPassword };
}
