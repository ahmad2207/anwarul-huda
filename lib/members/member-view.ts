import type { CheckInMethod, GatheringType, Prisma, RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accountLockoutKey, checkAccountLockout } from "@/lib/login-lockout";
import { canViewMemberActivity } from "@/lib/authorization";

// Queries behind the tabs of the administrator member view
// (MEMBER-HOME-AND-ADMIN-VIEW.md 2). Every function takes a member id the
// caller has already cleared through canViewMember: the wing check
// happens once, in app/admin/members/[id]/load-member.ts, before any of
// these run. Charity history and activity are the exceptions: each
// carries its own role check, in lib/members/charity-history.ts and in
// getMemberActivity below.

/** A staff member's label wherever a name is needed: users carry no name of their own. */
export function staffLabel(user: { email: string | null; phone: string | null } | null): string {
  return user?.email ?? user?.phone ?? "Unknown";
}

// ---------------------------------------------------------------
// Attendance (2.2)
// ---------------------------------------------------------------

export interface AttendanceLogFilter {
  from: Date;
  to: Date;
  type?: GatheringType;
}

export interface AttendanceLogRow {
  id: string;
  gatheringTitle: string;
  gatheringType: GatheringType;
  gatheringStartsAt: Date;
  checkedInAt: Date;
  method: CheckInMethod;
  /** Set only for a manual check-in: the officer who recorded it. */
  recordedBy: string | null;
}

function attendanceLogWhere(memberId: string, filter: AttendanceLogFilter): Prisma.AttendanceRecordWhereInput {
  return {
    memberId,
    checkedInAt: { gte: filter.from, lt: filter.to },
    ...(filter.type ? { gathering: { type: filter.type } } : {}),
  };
}

/**
 * The attendance log, newest first. recordedById has no relation on the
 * model, so the officers are looked up in one extra query for the page
 * rather than per row. Pass `page: null` for every row (the export).
 */
export async function getAttendanceLog(
  memberId: string,
  filter: AttendanceLogFilter,
  pagination: { page: number; pageSize: number } | null,
): Promise<{ rows: AttendanceLogRow[]; total: number }> {
  const where = attendanceLogWhere(memberId, filter);
  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      select: {
        id: true,
        checkedInAt: true,
        method: true,
        recordedById: true,
        gathering: { select: { title: true, type: true, startsAt: true } },
      },
      orderBy: { checkedInAt: "desc" },
      ...(pagination ? { skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize } : {}),
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  const officerIds = [
    ...new Set(
      records.filter((record) => record.method === "MANUAL" && record.recordedById).map((record) => record.recordedById!),
    ),
  ];
  const officers = officerIds.length
    ? await prisma.user.findMany({ where: { id: { in: officerIds } }, select: { id: true, email: true, phone: true } })
    : [];
  const officerLabels = new Map(officers.map((officer) => [officer.id, staffLabel(officer)]));

  return {
    total,
    rows: records.map((record) => ({
      id: record.id,
      gatheringTitle: record.gathering.title,
      gatheringType: record.gathering.type,
      gatheringStartsAt: record.gathering.startsAt,
      checkedInAt: record.checkedInAt,
      method: record.method,
      recordedBy:
        record.method === "MANUAL" && record.recordedById
          ? (officerLabels.get(record.recordedById) ?? "Unknown")
          : null,
    })),
  };
}

export interface AttendanceStats {
  lastAttendedAt: Date | null;
  /** The longest stretch between two consecutive check-ins in the period, in whole days. Null with fewer than two. */
  longestGapDays: number | null;
  /** How the member was checked in during the period, by method. */
  methodCounts: Partial<Record<CheckInMethod, number>>;
  isFaceEnrolled: boolean;
}

export async function getAttendanceStats(memberId: string, period: { from: Date; to: Date }): Promise<AttendanceStats> {
  const [last, gapRows, methodRows, faceEnrolments] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: { memberId },
      select: { checkedInAt: true },
      orderBy: { checkedInAt: "desc" },
    }),
    // LAG pairs each check-in with the one before it; the longest of
    // those intervals is the gap. Done in the database so a long period
    // never loads every check-in just to compare neighbours.
    prisma.$queryRaw<{ longest_gap_seconds: number | null }[]>`
      SELECT MAX(EXTRACT(EPOCH FROM (checked_in_at - previous))) AS longest_gap_seconds
      FROM (
        SELECT checked_in_at, LAG(checked_in_at) OVER (ORDER BY checked_in_at) AS previous
        FROM attendance_records
        WHERE member_id = ${memberId} AND checked_in_at >= ${period.from} AND checked_in_at < ${period.to}
      ) AS paired
    `,
    prisma.attendanceRecord.groupBy({
      by: ["method"],
      where: { memberId, checkedInAt: { gte: period.from, lt: period.to } },
      _count: { _all: true },
    }),
    prisma.faceEnrolment.count({ where: { memberId, isActive: true } }),
  ]);

  const longestGapSeconds = gapRows[0]?.longest_gap_seconds;
  return {
    lastAttendedAt: last?.checkedInAt ?? null,
    longestGapDays: longestGapSeconds == null ? null : Math.floor(Number(longestGapSeconds) / 86400),
    methodCounts: Object.fromEntries(methodRows.map((row) => [row.method, row._count._all])),
    isFaceEnrolled: faceEnrolments > 0,
  };
}

// ---------------------------------------------------------------
// Payments and contributions (2.3)
// ---------------------------------------------------------------

export async function getMemberPayments(memberId: string, pagination: { page: number; pageSize: number }) {
  const where = { memberId };
  const [payments, total] = await Promise.all([
    // Voided payments are included, in place, never filtered out.
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        receiptNumber: true,
        amountKobo: true,
        method: true,
        status: true,
        paidAt: true,
        voidedAt: true,
        voidReason: true,
        plan: { select: { name: true } },
        fund: { select: { name: true } },
        collectedBy: { select: { email: true, phone: true } },
        voidedBy: { select: { email: true, phone: true } },
        cashSession: { select: { label: true } },
      },
      orderBy: { paidAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.payment.count({ where }),
  ]);
  return { payments, total };
}

export async function getMemberContributions(memberId: string, pagination: { page: number; pageSize: number }) {
  const where = { memberId };
  const [records, total] = await Promise.all([
    prisma.contributionRecord.findMany({
      where,
      select: {
        id: true,
        periodLabel: true,
        periodStart: true,
        amountDueKobo: true,
        amountPaidKobo: true,
        plan: { select: { name: true } },
      },
      orderBy: [{ periodStart: "desc" }, { plan: { name: "asc" } }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.contributionRecord.count({ where }),
  ]);
  return { records, total };
}

export interface MemberMoneyTotals {
  /** Every confirmed payment ever recorded for this member. Voided ones never count. */
  totalPaidKobo: number;
  /** What is still owed across every contribution record, never negative per record. */
  arrearsKobo: number;
}

export async function getMemberMoneyTotals(memberId: string): Promise<MemberMoneyTotals> {
  const [paid, arrears] = await Promise.all([
    prisma.payment.aggregate({ where: { memberId, status: "CONFIRMED" }, _sum: { amountKobo: true } }),
    // GREATEST per row, so an overpaid period cannot silently cancel out
    // another period's arrears.
    prisma.$queryRaw<{ arrears: bigint | null }[]>`
      SELECT SUM(GREATEST(amount_due_kobo - amount_paid_kobo, 0)) AS arrears
      FROM contribution_records
      WHERE member_id = ${memberId}
    `,
  ]);
  return { totalPaidKobo: paid._sum.amountKobo ?? 0, arrearsKobo: Number(arrears[0]?.arrears ?? 0) };
}

// ---------------------------------------------------------------
// Account and access (2.5)
// ---------------------------------------------------------------

export type FaceStatus =
  /** Checked in by name for good: after a face match review, or because the member will not use face check-in. */
  | { kind: "excluded"; excludedAt: Date | null; reason: "review" | "declined" }
  | { kind: "enrolled"; enrolledAt: Date }
  | { kind: "held_for_review" }
  | { kind: "deferred"; deferredAt: Date | null }
  | { kind: "not_set_up" };

export async function getMemberAccess(member: {
  id: string;
  faceEnrolmentDeferred: boolean;
  faceEnrolmentDeferredAt: Date | null;
  faceCheckInExcluded: boolean;
  faceCheckInExcludedAt: Date | null;
}) {
  const [user, enrolment, openCases, differentPeopleCases] = await Promise.all([
    prisma.user.findUnique({
      where: { memberId: member.id },
      select: {
        id: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        mustChangePassword: true,
        temporaryPasswordIssuedAt: true,
        temporaryPasswordIssuedBy: { select: { email: true, phone: true } },
      },
    }),
    // Never the embedding: only whether one exists and when.
    prisma.faceEnrolment.findFirst({
      where: { memberId: member.id, isActive: true },
      select: { enrolledAt: true },
      orderBy: { enrolledAt: "desc" },
    }),
    // Whether an attempt to enrol is waiting on a face match review. Only
    // that it is, never who with: the review queue shows that, to the
    // people allowed to see it.
    prisma.faceMatchCase.count({ where: { status: "OPEN", source: "ENROLMENT", memberAId: member.id } }),
    // How an exclusion came about: a review deciding this member cannot be
    // told apart from someone else, or otherwise an officer recording that
    // they will not use face check-in.
    member.faceCheckInExcluded
      ? prisma.faceMatchCase.count({
          where: { status: "INDISTINGUISHABLE", OR: [{ memberAId: member.id }, { memberBId: member.id }] },
        })
      : Promise.resolve(0),
  ]);

  const face: FaceStatus = member.faceCheckInExcluded
    ? {
        kind: "excluded",
        excludedAt: member.faceCheckInExcludedAt,
        reason: differentPeopleCases > 0 ? "review" : "declined",
      }
    : enrolment
    ? { kind: "enrolled", enrolledAt: enrolment.enrolledAt }
    : openCases > 0
    ? { kind: "held_for_review" }
    : member.faceEnrolmentDeferred
      ? { kind: "deferred", deferredAt: member.faceEnrolmentDeferredAt }
      : { kind: "not_set_up" };

  const lockout = user ? await checkAccountLockout(accountLockoutKey(user.id)) : { locked: false };

  return { user, face, lockout };
}

// ---------------------------------------------------------------
// Activity (2.6)
// ---------------------------------------------------------------

export class MemberActivityAccessError extends Error {
  constructor() {
    super("Only a super administrator can see a member's activity");
    this.name = "MemberActivityAccessError";
  }
}

/**
 * The audit trail for this member: changes to the member row itself and
 * to their login account. Payments and attendance have their own tabs.
 * Super admins only (SPEC.md section 4). The check is here, in the only
 * function that reads this trail for the member view, so no caller gets
 * the rows without passing it, not only on the page that renders them.
 */
export async function getMemberActivity(
  viewer: { roles: RoleName[] },
  member: { id: string; userId: string | null },
  pagination: { page: number; pageSize: number },
) {
  if (!canViewMemberActivity(viewer)) {
    throw new MemberActivityAccessError();
  }
  const where: Prisma.AuditLogWhereInput = {
    OR: [
      { entity: "Member", entityId: member.id },
      ...(member.userId ? [{ entity: "User", entityId: member.userId }] : []),
    ],
  };
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entity: true,
        actorId: true,
        before: true,
        after: true,
        createdAt: true,
        actor: { select: { email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { entries, total };
}

/**
 * Fields whose values are never shown on the member view, even to an
 * administrator allowed to see the trail: a changed password hash is
 * reported as changed, never printed.
 */
const HIDDEN_AUDIT_FIELDS = new Set(["passwordHash", "embedding"]);

export function isHiddenAuditField(field: string): boolean {
  return HIDDEN_AUDIT_FIELDS.has(field);
}
