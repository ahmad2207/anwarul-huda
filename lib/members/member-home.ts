import { prisma } from "@/lib/prisma";
import { getLagosDateParts, lagosMidnightUtc, LAGOS_TIME_ZONE } from "@/lib/timezone";
import { recordProgress, type RecordSectionDefinition } from "@/lib/members/record-sections";
import type { ContentType, GatheringType, Prisma, RecordSection } from "@prisma/client";

// The member home's "Needs your attention" block
// (MEMBER-HOME-AND-ADMIN-VIEW.md 1.1). Each item is present only when it
// is genuinely outstanding; an empty result means the block is not
// rendered at all, never shown as "nothing to do".

export interface OutstandingBalance {
  totalKobo: number;
  /** Distinct plan names with something unpaid, most recently due first. */
  planNames: string[];
  /** Start of the oldest unpaid period: the "since when". */
  since: Date;
}

export interface AttentionItems {
  balance: OutstandingBalance | null;
  /** The next section to complete, when the record is not yet done. */
  nextRecordSection: RecordSectionDefinition | null;
}

export function hasAttentionItems(items: AttentionItems): boolean {
  return items.balance !== null || items.nextRecordSection !== null;
}

// Face check-in is deliberately not an item here. Once a member has
// deferred or cannot use it, the office chases it from the enrolment
// worklist, not the member's own screen (MEMBER-INTERFACE.md section 6: no
// prompt, badge or reminder about face enrolment after a deferral).
export async function getAttentionItems(member: {
  id: string;
  completedSections: RecordSection[];
}): Promise<AttentionItems> {
  // amountPaidKobo < amountDueKobo is a column-to-column comparison
  // Prisma's query builder cannot express, so one member's own records
  // are fetched and filtered here, as the home page already did.
  const records = await prisma.contributionRecord.findMany({
    where: { memberId: member.id },
    select: {
      periodStart: true,
      amountDueKobo: true,
      amountPaidKobo: true,
      plan: { select: { name: true } },
    },
    orderBy: { periodStart: "desc" },
  });

  const unpaid = records.filter((record) => record.amountPaidKobo < record.amountDueKobo);
  const balance: OutstandingBalance | null =
    unpaid.length === 0
      ? null
      : {
          totalKobo: unpaid.reduce((sum, record) => sum + (record.amountDueKobo - record.amountPaidKobo), 0),
          planNames: [...new Set(unpaid.map((record) => record.plan.name))],
          // Ordered newest first, so the last unpaid record is the oldest.
          since: unpaid[unpaid.length - 1].periodStart,
        };

  // isRecordIncomplete only tracks the nominal roll's missing name or
  // phone. A self-registered or admin-entered member starts with it
  // false and no sections saved, so they reach the complete home with
  // sections still to do. That is what this item catches.
  const progress = recordProgress(member.completedSections);

  return {
    balance,
    nextRecordSection: progress.isComplete ? null : progress.nextSection,
  };
}

// "What is next" (MEMBER-HOME-AND-ADMIN-VIEW.md 1.2).

export interface UpcomingGathering {
  id: string;
  title: string;
  type: GatheringType;
  startsAt: Date;
  branchName: string | null;
}

/**
 * The next two gatherings this member can attend: their own wing's or
 * those open to every wing (wingId null), not closed, and either still
 * to start or already started but not yet ended. A gathering the member
 * has already checked in to is skipped, since it is no longer "next" for
 * them.
 */
export async function getUpcomingGatherings(
  member: { id: string; wingId: string },
  now: Date = new Date(),
): Promise<UpcomingGathering[]> {
  const gatherings = await prisma.gathering.findMany({
    where: {
      isClosed: false,
      OR: [{ wingId: null }, { wingId: member.wingId }],
      AND: [{ OR: [{ startsAt: { gte: now } }, { endsAt: { gt: now } }] }],
      records: { none: { memberId: member.id } },
    },
    select: {
      id: true,
      title: true,
      type: true,
      startsAt: true,
      branch: { select: { name: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 2,
  });

  return gatherings.map((gathering) => ({
    id: gathering.id,
    title: gathering.title,
    type: gathering.type,
    startsAt: gathering.startsAt,
    branchName: gathering.branch?.name ?? null,
  }));
}

// "Your attendance" (MEMBER-HOME-AND-ADMIN-VIEW.md 1.3). A count and a
// date only: never a percentage, a streak, a badge or a ranking.

export interface AttendanceSummary {
  attendedThisMonth: number;
  heldThisMonth: number;
  lastAttendedAt: Date | null;
}

/**
 * Gatherings held this Lagos calendar month, up to now, that were open
 * to this member (their wing or all wings), and how many of those same
 * gatherings they attended. Attended is counted from the same set as
 * held, so a check-in at another wing's gathering can never make the
 * count read "5 of 4".
 */
export async function getAttendanceSummary(
  member: { id: string; wingId: string },
  now: Date = new Date(),
): Promise<AttendanceSummary> {
  const { year, month } = getLagosDateParts(now);
  const heldThisMonth: Prisma.GatheringWhereInput = {
    OR: [{ wingId: null }, { wingId: member.wingId }],
    startsAt: { gte: lagosMidnightUtc(year, month, 1), lte: now },
  };

  const [held, attended, last] = await Promise.all([
    prisma.gathering.count({ where: heldThisMonth }),
    prisma.attendanceRecord.count({ where: { memberId: member.id, gathering: heldThisMonth } }),
    prisma.attendanceRecord.findFirst({
      where: { memberId: member.id },
      select: { checkedInAt: true },
      orderBy: { checkedInAt: "desc" },
    }),
  ]);

  return { attendedThisMonth: attended, heldThisMonth: held, lastAttendedAt: last?.checkedInAt ?? null };
}

// "Your service" (MEMBER-HOME-AND-ADMIN-VIEW.md 1.4). Just the areas
// until rotas exist.

export async function getServiceAreaNames(memberId: string): Promise<string[]> {
  const areas = await prisma.memberServiceArea.findMany({
    where: { memberId },
    select: { serviceArea: { select: { name: true } } },
    orderBy: { serviceArea: { sortOrder: "asc" } },
  });
  return areas.map((area) => area.serviceArea.name);
}

// "Latest" (MEMBER-HOME-AND-ADMIN-VIEW.md 1.5).

export interface LatestContentItem {
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  deliveredOn: Date | null;
}

/**
 * The most recent item of one type this member can see: published, past
 * its publish time if it has one, and open to all wings or to theirs.
 * The same rule as lib/content/visibility.ts, expressed as a query.
 */
export function getLatestContent(
  type: Extract<ContentType, "ANNOUNCEMENT" | "SERMON" | "WEEKLY_BOOK">,
  wingId: string,
  now: Date = new Date(),
): Promise<LatestContentItem | null> {
  return prisma.contentItem.findFirst({
    where: {
      type,
      isPublished: true,
      AND: [
        { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
        { OR: [{ wingId: null }, { wingId }] },
      ],
    },
    select: { slug: true, title: true, summary: true, body: true, deliveredOn: true },
    orderBy: { createdAt: "desc" },
  });
}

/** "Friday 26 September, 1:30 pm", in Lagos time. */
export function formatGatheringWhen(startsAt: Date): string {
  const day = startsAt.toLocaleDateString("en-GB", {
    timeZone: LAGOS_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = startsAt.toLocaleTimeString("en-GB", {
    timeZone: LAGOS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day}, ${time}`;
}

/** "12 September", in Lagos time. */
export function formatDayMonth(instant: Date): string {
  return instant.toLocaleDateString("en-GB", { timeZone: LAGOS_TIME_ZONE, day: "numeric", month: "long" });
}

/** "July 2026", in Lagos time. */
export function formatMonthYear(instant: Date): string {
  return instant.toLocaleDateString("en-GB", { timeZone: LAGOS_TIME_ZONE, month: "long", year: "numeric" });
}
