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
 * Where a staff member lands on /admin, which every sign-in goes to. The
 * overview there is the committee's organisation-wide summary, for super
 * admins only; everyone else is sent to the page their own role works
 * from, rather than being shown an error. A user holding several roles
 * lands on the first match in this order. Null for a super admin (stay
 * on the overview) or an account with no staff role at all.
 */
export function staffHomePath(user: { roles: RoleName[] }): string | null {
  if (user.roles.includes("SUPER_ADMIN")) return null;
  const homes: Array<[RoleName, string]> = [
    ["WING_ADMIN", "/admin/members"],
    ["ATTENDANCE_OFFICER", "/admin/attendance"],
    ["FINANCE_OFFICER", "/admin/payments"],
    ["CHARITY_OFFICER", "/admin/charity"],
    ["CONTENT_EDITOR", "/admin/content"],
  ];
  return homes.find(([role]) => user.roles.includes(role))?.[1] ?? null;
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
 * Whether this user may enrol a member's face in person at the mosque
 * (MEMBER-HOME-AND-ADMIN-VIEW.md 3.7): the roles that run check-in
 * (SPEC.md section 4), for a member in a wing they cover. A finance
 * officer can view every member but does not run check-in, so cannot
 * enrol.
 */
export function canEnrolMemberFace(user: { roles: RoleName[]; wingIds: string[] }, memberWingId: string): boolean {
  if (user.roles.includes("SUPER_ADMIN")) return true;
  return (
    (user.roles.includes("ATTENDANCE_OFFICER") || user.roles.includes("WING_ADMIN")) &&
    user.wingIds.includes(memberWingId)
  );
}

/**
 * Whose members this user may see and check in at a gathering: "all" for
 * every wing, a list of wing ids, or null for no access at all.
 *
 * Attendance officers and wing administrators cover their own wing only
 * (SPEC.md section 4). A gathering open to all wings, such as a general
 * Jumu'ah, is still run by attendance officers, but each one sees and
 * checks in only the members of the wings they are assigned to.
 */
export function gatheringCheckInScope(
  user: { roles: RoleName[]; wingIds: string[] },
  gatheringWingId: string | null,
): "all" | string[] | null {
  if (canViewAllWings(user)) {
    return gatheringWingId ? [gatheringWingId] : "all";
  }
  if (gatheringWingId) {
    return user.wingIds.includes(gatheringWingId) ? [gatheringWingId] : null;
  }
  return user.roles.includes("ATTENDANCE_OFFICER") && user.wingIds.length > 0 ? user.wingIds : null;
}

/**
 * Whether this user may see and decide a face match case between two
 * members (MEMBER-HOME-AND-ADMIN-VIEW.md 3.5): super admins always, and
 * attendance officers only when both members are in wings they are
 * assigned to. A case spanning a wing the officer does not cover would
 * put another wing's member's name in front of them, so it is left to a
 * super admin.
 */
export function canReviewFaceMatch(
  user: { roles: RoleName[]; wingIds: string[] },
  memberAWingId: string,
  memberBWingId: string,
): boolean {
  if (user.roles.includes("SUPER_ADMIN")) return true;
  return (
    user.roles.includes("ATTENDANCE_OFFICER") &&
    user.wingIds.includes(memberAWingId) &&
    user.wingIds.includes(memberBWingId)
  );
}

/**
 * Whether this user may see a member's audit trail, the Activity tab on
 * the member view. Super admins only, matching SPEC.md section 4, where
 * viewing the audit log is a super admin capability alone.
 */
export function canViewMemberActivity(user: { roles: RoleName[] }): boolean {
  return user.roles.includes("SUPER_ADMIN");
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
