import { prisma } from "@/lib/prisma";
import { formatMemberName } from "@/lib/members/display-name";
import { recordProgress } from "@/lib/members/record-sections";

export type MemberProgressStatus = "NEVER_LOGGED_IN" | "NOT_STARTED" | "PARTWAY" | "FINISHED";

export const PROGRESS_STATUSES: readonly MemberProgressStatus[] = [
  "NEVER_LOGGED_IN",
  "NOT_STARTED",
  "PARTWAY",
  "FINISHED",
];

export const PROGRESS_STATUS_LABELS: Record<MemberProgressStatus, string> = {
  NEVER_LOGGED_IN: "Never logged in",
  NOT_STARTED: "Logged in, not started",
  PARTWAY: "Partway through",
  FINISHED: "Finished",
};

export interface MemberProgressRow {
  memberId: string;
  displayName: string;
  memberNumber: string | null;
  wingId: string;
  wingName: string;
  status: MemberProgressStatus;
  isRecordIncomplete: boolean;
  completedCount: number;
  totalSections: number;
  nextSectionLabel: string | null;
  lastLoginAt: Date | null;
}

/**
 * Where every member stands on their own nine-section record
 * (MEMBER-INTERFACE.md 3.4), for the office to work through
 * (MEMBER-INTERFACE.md 4, M4 #3). Never logged in is checked first,
 * regardless of what an administrator may have entered on a member's
 * behalf (app/admin/members/incomplete/actions.ts): that group is the
 * one the office chases, and a partial completedSections count from an
 * admin fix does not change the fact nobody has actually signed in yet.
 */
export async function getMemberProgressReport(wingIds: string[] | null): Promise<MemberProgressRow[]> {
  const members = await prisma.member.findMany({
    where: wingIds ? { wingId: { in: wingIds } } : {},
    include: {
      wing: true,
      user: { select: { lastLoginAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return members.map((member) => {
    const progress = recordProgress(member.completedSections);
    const status: MemberProgressStatus = !member.user?.lastLoginAt
      ? "NEVER_LOGGED_IN"
      : progress.isComplete
        ? "FINISHED"
        : progress.completedCount === 0
          ? "NOT_STARTED"
          : "PARTWAY";

    return {
      memberId: member.id,
      displayName: formatMemberName(member),
      memberNumber: member.memberNumber,
      wingId: member.wingId,
      wingName: member.wing.name,
      status,
      isRecordIncomplete: member.isRecordIncomplete,
      completedCount: progress.completedCount,
      totalSections: progress.total,
      nextSectionLabel: progress.nextSection?.label ?? null,
      lastLoginAt: member.user?.lastLoginAt ?? null,
    };
  });
}
