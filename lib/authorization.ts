import type { RoleName } from "@prisma/client";

// Pure authorisation decisions, with no dependency on a session or the
// database. Kept separate from lib/auth.ts, which pulls in Auth.js, so
// these can be unit tested directly without Auth.js's module resolution
// getting involved at all.

/**
 * SUPER_ADMIN always passes, matching the "everything" row in the spec's
 * roles table, otherwise the user must hold at least one of the given
 * roles.
 */
export function hasAnyRole(user: { roles: RoleName[] }, roles: RoleName[]): boolean {
  return user.roles.includes("SUPER_ADMIN") || user.roles.some((role) => roles.includes(role));
}

/**
 * SUPER_ADMIN always passes, otherwise the user must have an explicit
 * assignment to the wing.
 */
export function canAccessWing(
  user: { roles: RoleName[]; wingIds: string[] },
  wingId: string,
): boolean {
  return user.roles.includes("SUPER_ADMIN") || user.wingIds.includes(wingId);
}

/**
 * The spec's roles table gives finance officers "all wings, read only" for
 * viewing the member register, unlike a wing administrator or attendance
 * officer, who are limited to their own wing's members.
 */
export function canViewAllWings(user: { roles: RoleName[] }): boolean {
  return user.roles.includes("SUPER_ADMIN") || user.roles.includes("FINANCE_OFFICER");
}

/**
 * Editing member records is narrower than viewing them: only a wing
 * administrator for their own wing, or a super admin for any wing. Finance
 * and attendance officers can view the register but not edit it.
 */
export function canEditMemberRecords(
  user: { roles: RoleName[]; wingIds: string[] },
  memberWingId: string,
): boolean {
  if (user.roles.includes("SUPER_ADMIN")) {
    return true;
  }
  return user.roles.includes("WING_ADMIN") && canAccessWing(user, memberWingId);
}
