import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessWing, hasAnyRole } from "@/lib/authorization";
import type { RoleName } from "@prisma/client";

// Re-exported so existing callers of lib/auth can keep using these without
// knowing they now live in lib/authorization.
export { canAccessWing, hasAnyRole };

// Server side authorisation helpers. Every one of these throws rather than
// returning null or false, so a missing or forgotten check fails loudly
// instead of silently letting a request through. Call these at the top of
// every server action and route handler that touches protected data.

export class AuthenticationError extends Error {
  constructor(message = "You must be signed in to do this") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to do this") {
    super(message);
    this.name = "AuthorizationError";
  }
}

// Thrown by requireRole and requireWingAccess, never by getCurrentUser
// itself: app/change-password/actions.ts calls getCurrentUser directly,
// specifically so a forced-change account can still load itself and
// change its own password. Every other mutation goes through one of the
// two functions below, so gating there is what makes "every route,
// including any API route" (MEMBER-INTERFACE.md 2 / point 6 of the
// credential issue prompt) hold for every action this app has today and
// every one it adds later, not only the page layouts that redirect a
// browser navigation (app/admin/layout.tsx, components/member-shell.tsx).
export class PasswordChangeRequiredError extends Error {
  constructor(message = "You must change your temporary password before continuing") {
    super(message);
    this.name = "PasswordChangeRequiredError";
  }
}

export interface CurrentUser {
  id: string;
  email: string | null;
  phone: string | null;
  memberId: string | null;
  roles: RoleName[];
  /** Wings this user is explicitly scoped to. A SUPER_ADMIN has no rows here but is not wing restricted. */
  wingIds: string[];
  /** True after an administrator issues or reissues a temporary password, until the forced change is completed. Checked on every protected route; see app/admin/layout.tsx and components/member-shell.tsx. */
  mustChangePassword: boolean;
}

/**
 * Returns the signed in user, loaded fresh from the database so a role or
 * wing assignment change takes effect immediately, not only when the
 * session token is next reissued.
 *
 * Throws AuthenticationError if nobody is signed in, or if the account has
 * been deactivated since the session was issued.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new AuthenticationError();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
      wingAssignments: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AuthenticationError("Your account is no longer active");
  }

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    memberId: user.memberId,
    roles: user.roles.map((userRole) => userRole.role),
    wingIds: user.wingAssignments.map((assignment) => assignment.wingId),
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Requires the current user to hold at least one of the given roles.
 * Throws AuthenticationError or AuthorizationError, and returns the
 * current user on success so callers do not need a second lookup.
 */
export async function requireRole(roles: RoleName[]): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (user.mustChangePassword) {
    throw new PasswordChangeRequiredError();
  }

  if (!hasAnyRole(user, roles)) {
    throw new AuthorizationError(
      `This action requires one of the following roles: ${roles.join(", ")}`,
    );
  }

  return user;
}

/**
 * Requires the current user to have access to the given wing: either
 * SUPER_ADMIN, or an explicit assignment to that wing. This is the check
 * every query scoped to a wing must call on the server, never a check that
 * only hides a button in the UI.
 */
export async function requireWingAccess(wingId: string): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (user.mustChangePassword) {
    throw new PasswordChangeRequiredError();
  }

  if (!canAccessWing(user, wingId)) {
    throw new AuthorizationError("You do not have access to this wing");
  }

  return user;
}
