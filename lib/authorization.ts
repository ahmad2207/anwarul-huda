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
 * Whether this user may open a member's record at all: a role that can
 * view the register (SPEC.md section 4), and either all wings or an
 * assignment to the member's own wing. A super admin with no wing
 * assignment sees every wing. Charity officers and content editors are
 * not in the list: the roles table gives them no view of the register.
 */
export function canViewMember(user: { roles: RoleName[]; wingIds: string[] }, memberWingId: string): boolean {
  if (!hasAnyRole(user, ["WING_ADMIN", "FINANCE_OFFICER", "ATTENDANCE_OFFICER"])) {
    return false;
  }
  return canViewAllWings(user) || user.wingIds.includes(memberWingId);
}

/**
 * Whether a member's charity beneficiary history may be shown to this
 * user (MEMBER-HOME-AND-ADMIN-VIEW.md 2.7): charity officers and super
 * admins only. A member's need is not general administrative context, so
 * a wing admin, finance or attendance officer who can open the member's
 * record still never sees it. hasAnyRole is deliberately not reused here
 * with a wider list: this is the whole rule, spelled out.
 */
export function canViewCharityHistory(user: { roles: RoleName[] }): boolean {
  return user.roles.includes("SUPER_ADMIN") || user.roles.includes("CHARITY_OFFICER");
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
