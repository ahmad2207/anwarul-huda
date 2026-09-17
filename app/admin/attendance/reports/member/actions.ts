"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { formatMemberName } from "@/lib/members/display-name";

export interface ReportMemberSearchResult {
  id: string;
  label: string;
  memberNumber: string | null;
  wingName: string;
}

/** Scoped the same way the check-in and gatherings reports are: attendance officers and super admins see everyone, a wing admin only their own wing's members. */
export async function searchMembersForAttendanceReport(query: string): Promise<ReportMemberSearchResult[]> {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");

  const q = query.trim();
  if (q.length < 2) return [];

  const members = await prisma.member.findMany({
    where: {
      ...(canSeeAll ? {} : { wingId: { in: user.wingIds } }),
      OR: [
        { surname: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { fullNameAsWritten: { contains: q, mode: "insensitive" } },
        { memberNumber: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    include: { wing: true },
    take: 10,
    orderBy: { surname: "asc" },
  });

  return members.map((member) => ({
    id: member.id,
    label: `${formatMemberName(member)}${member.memberNumber ? ` (${member.memberNumber})` : ""}`,
    memberNumber: member.memberNumber,
    wingName: member.wing.name,
  }));
}

export interface SelectedMember {
  id: string;
  surname: string | null;
  firstName: string | null;
  fullNameAsWritten: string | null;
  memberNumber: string | null;
  wingName: string;
}

/** Loads the one selected member's display details, re-checking wing scope so a wing admin cannot view another wing's member by editing the URL. */
export async function loadReportMember(memberId: string): Promise<SelectedMember | null> {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");

  const member = await prisma.member.findUnique({ where: { id: memberId }, include: { wing: true } });
  if (!member) return null;
  if (!canSeeAll && !user.wingIds.includes(member.wingId)) return null;

  return {
    id: member.id,
    surname: member.surname,
    firstName: member.firstName,
    fullNameAsWritten: member.fullNameAsWritten,
    memberNumber: member.memberNumber,
    wingName: member.wing.name,
  };
}
