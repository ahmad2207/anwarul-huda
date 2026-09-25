import { requireRole } from "@/lib/auth";
import { canViewMember } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const MEMBER_INCLUDE = {
  wing: true,
  branch: true,
  household: { include: { linkedMember: true }, orderBy: { fullName: "asc" } },
  serviceAreas: true,
  user: { select: { id: true, mustChangePassword: true } },
} as const;

/**
 * The one gate for the member view and everything under it (the page,
 * every tab, the attendance export): the viewer's role and wing scope
 * are checked here, on the server, before any member data is returned.
 * Returns null for a member who does not exist and for one outside the
 * viewer's wings alike, so the page cannot be used to probe which ids
 * exist in other wings.
 */
export async function loadViewableMember(id: string) {
  const user = await requireRole(["WING_ADMIN", "FINANCE_OFFICER", "ATTENDANCE_OFFICER"]);
  const member = await prisma.member.findUnique({ where: { id }, include: MEMBER_INCLUDE });
  if (!member || !canViewMember(user, member.wingId)) {
    return null;
  }
  return { user, member };
}

export type ViewableMember = NonNullable<Awaited<ReturnType<typeof loadViewableMember>>>["member"];
