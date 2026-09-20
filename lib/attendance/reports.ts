import type { GatheringType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMemberName } from "@/lib/members/display-name";

// The four reports Phase 5 asks for. Each has a "load" function that hits
// the database and a "compute" function that does the actual arithmetic,
// kept separate wherever there is real arithmetic to get right, so that
// part can be unit tested without a database.

/**
 * A user's attendance scope: null means no restriction (attendance
 * officer or above see every wing), otherwise the wing ids they are
 * confined to. Matches the canSeeAll pattern already used on the
 * gatherings list and check-in screens.
 */
export type WingScope = string[] | null;

/**
 * Resolves a wing filter coming from the query string against what the
 * user is actually allowed to see. A wing id outside the user's scope is
 * ignored rather than honoured, so a wing admin cannot see another wing's
 * figures just by editing the URL. Returns undefined when no single-wing
 * filter applies (either none was requested, or the one requested was not
 * allowed), in which case callers should fall back to the full scope.
 */
export function resolveWingFilter(requestedWingId: string | undefined, scope: WingScope): string | undefined {
  if (!requestedWingId) return undefined;
  if (scope === null || scope.includes(requestedWingId)) return requestedWingId;
  return undefined;
}

export interface GatheringReportFilter {
  from?: Date;
  to?: Date;
  type?: GatheringType;
  wingId?: string;
  scope: WingScope;
}

export interface GatheringReportRow {
  gatheringId: string;
  title: string;
  type: GatheringType;
  wingName: string;
  startsAt: Date;
  isClosed: boolean;
  checkedInCount: number;
}

/** Attendance per gathering: a filtered, exportable list of gatherings and how many checked in to each. */
export async function getGatheringAttendanceReport(filter: GatheringReportFilter): Promise<GatheringReportRow[]> {
  const gatherings = await prisma.gathering.findMany({
    where: {
      ...(filter.from || filter.to
        ? { startsAt: { gte: filter.from, lte: filter.to } }
        : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.wingId
        ? { wingId: filter.wingId }
        : filter.scope
          ? { OR: [{ wingId: null }, { wingId: { in: filter.scope } }] }
          : {}),
    },
    include: { wing: true, _count: { select: { records: true } } },
    orderBy: { startsAt: "desc" },
  });

  return gatherings.map((gathering) => ({
    gatheringId: gathering.id,
    title: gathering.title,
    type: gathering.type,
    wingName: gathering.wing?.name ?? "All wings",
    startsAt: gathering.startsAt,
    isClosed: gathering.isClosed,
    checkedInCount: gathering._count.records,
  }));
}

export interface GatheringAttendeeRow {
  memberId: string;
  name: string;
  memberNumber: string | null;
  checkedInAt: Date;
}

/** Who actually attended a specific gathering: every checked-in member, in the order they checked in. */
export async function getGatheringAttendeeList(gatheringId: string): Promise<GatheringAttendeeRow[]> {
  const records = await prisma.attendanceRecord.findMany({
    where: { gatheringId },
    include: { member: true },
    orderBy: { checkedInAt: "asc" },
  });

  return records.map((record) => ({
    memberId: record.memberId,
    name: formatMemberName(record.member),
    memberNumber: record.member.memberNumber,
    checkedInAt: record.checkedInAt,
  }));
}

export interface MemberAttendanceRow {
  gatheringId: string;
  title: string;
  type: GatheringType;
  wingName: string;
  checkedInAt: Date;
  method: string;
}

/** Attendance per member over a period: every gathering a given member checked in to, in range. */
export async function getMemberAttendanceHistory(
  memberId: string,
  filter: { from?: Date; to?: Date },
): Promise<MemberAttendanceRow[]> {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      memberId,
      ...(filter.from || filter.to
        ? { checkedInAt: { gte: filter.from, lte: filter.to } }
        : {}),
    },
    include: { gathering: { include: { wing: true } } },
    orderBy: { checkedInAt: "desc" },
  });

  return records.map((record) => ({
    gatheringId: record.gathering.id,
    title: record.gathering.title,
    type: record.gathering.type,
    wingName: record.gathering.wing?.name ?? "All wings",
    checkedInAt: record.checkedInAt,
    method: record.method,
  }));
}

export interface WingAttendanceCounts {
  wingId: string;
  wingName: string;
  gatheringsHeld: number;
  totalCheckIns: number;
  activeMemberCount: number;
}

export interface WingAttendanceRateRow extends WingAttendanceCounts {
  ratePercent: number;
}

/**
 * The average attendance rate for a wing: total check-ins across every
 * gathering in scope for that wing (its own, plus any open to all wings),
 * divided by gatherings held times active members in the wing. Answers
 * "what share of the wing typically shows up to a gathering," which is
 * what was chosen over a plain "at least once" coverage measure.
 *
 * A wing with no gatherings, or no active members, has nothing to divide
 * by and reads as 0 percent rather than throwing or showing NaN.
 */
export function computeWingAttendanceRate(counts: WingAttendanceCounts): WingAttendanceRateRow {
  const denominator = counts.gatheringsHeld * counts.activeMemberCount;
  const ratePercent = denominator > 0 ? (counts.totalCheckIns / denominator) * 100 : 0;
  return { ...counts, ratePercent };
}

/** Attendance rate per wing over a period. Currently active members are used as the denominator; the model has no record of who was active on a past date. */
export async function getWingAttendanceRates(filter: {
  from?: Date;
  to?: Date;
  scope: WingScope;
}): Promise<WingAttendanceRateRow[]> {
  const wings = await prisma.wing.findMany({
    where: filter.scope ? { id: { in: filter.scope } } : {},
    orderBy: { name: "asc" },
  });

  const periodWhere = filter.from || filter.to ? { startsAt: { gte: filter.from, lte: filter.to } } : {};

  const rows = await Promise.all(
    wings.map(async (wing) => {
      const gatheringScope = { OR: [{ wingId: wing.id }, { wingId: null }] };
      const [gatheringsHeld, totalCheckIns, activeMemberCount] = await Promise.all([
        prisma.gathering.count({ where: { ...gatheringScope, ...periodWhere } }),
        prisma.attendanceRecord.count({ where: { gathering: { ...gatheringScope, ...periodWhere } } }),
        prisma.member.count({ where: { status: "ACTIVE", wingId: wing.id } }),
      ]);
      return computeWingAttendanceRate({
        wingId: wing.id,
        wingName: wing.name,
        gatheringsHeld,
        totalCheckIns,
        activeMemberCount,
      });
    }),
  );

  return rows;
}

export interface InactiveMemberRow {
  memberId: string;
  surname: string | null;
  firstName: string | null;
  fullNameAsWritten: string | null;
  memberNumber: string | null;
  wingName: string;
  lastAttendedAt: Date | null;
}

export interface InactiveMembersResult {
  rows: InactiveMemberRow[];
  total: number;
}

/**
 * Members who have not attended anything in a given number of weeks
 * (never having attended counts as not having attended). Filtered and
 * paginated at the database level, the same way the main member list is,
 * rather than loading the whole wing into memory to filter in
 * JavaScript, since this can plausibly cover most of the membership.
 */
export async function getMembersNotAttendedSince(params: {
  cutoff: Date;
  scope: WingScope;
  wingId?: string;
  page: number;
  pageSize: number;
}): Promise<InactiveMembersResult> {
  const wingWhere = params.wingId
    ? { wingId: params.wingId }
    : params.scope
      ? { wingId: { in: params.scope } }
      : {};

  const where = {
    status: "ACTIVE" as const,
    ...wingWhere,
    // "none" is true both for a member with no attendance records at all
    // and for one whose every attendance record is older than the cutoff,
    // which is exactly "has not attended since" including "never has".
    attendance: { none: { checkedInAt: { gte: params.cutoff } } },
  };

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      include: {
        wing: true,
        attendance: { orderBy: { checkedInAt: "desc" }, take: 1 },
      },
      orderBy: [{ surname: "asc" }, { firstName: "asc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.member.count({ where }),
  ]);

  return {
    rows: members.map((member) => ({
      memberId: member.id,
      surname: member.surname,
      firstName: member.firstName,
      fullNameAsWritten: member.fullNameAsWritten,
      memberNumber: member.memberNumber,
      wingName: member.wing.name,
      lastAttendedAt: member.attendance[0]?.checkedInAt ?? null,
    })),
    total,
  };
}
