import { prisma } from "@/lib/prisma";
import { getLagosDateParts, lagosMidnightUtc } from "@/lib/timezone";
import { computePeriod } from "@/lib/contributions/period";

// The four slices item 2 of Phase 7 asks for: membership totals and
// growth per wing, contribution collection against expectation, fund
// balances (already served by lib/charity/dashboard-data.ts, reused
// directly from the page rather than wrapped again here), and an
// attendance trend. Kept to one committee-level page, not a duplicate of
// the detailed reports each of these already has elsewhere.

export interface WingMembershipSummary {
  wingId: string;
  wingName: string;
  activeCount: number;
  newThisMonth: number;
}

/** Active members per wing, and how many of those became active this calendar month (Africa/Lagos), whether through approval or CSV import. */
export async function getMembershipSummary(): Promise<WingMembershipSummary[]> {
  const wings = await prisma.wing.findMany({ orderBy: { name: "asc" } });
  const { year, month } = getLagosDateParts();
  const monthStart = lagosMidnightUtc(year, month, 1);

  return Promise.all(
    wings.map(async (wing) => {
      const [activeCount, newThisMonth] = await Promise.all([
        prisma.member.count({ where: { wingId: wing.id, status: "ACTIVE" } }),
        prisma.member.count({
          where: { wingId: wing.id, status: "ACTIVE", createdAt: { gte: monthStart } },
        }),
      ]);
      return { wingId: wing.id, wingName: wing.name, activeCount, newThisMonth };
    }),
  );
}

export interface PlanCollectionSummary {
  planId: string;
  planName: string;
  periodLabel: string;
  totalDueKobo: number;
  totalPaidKobo: number;
  ratePercent: number;
}

/**
 * For every active contribution plan, its own current period (a weekly
 * plan and a monthly plan are never on the same period label, so each
 * plan is compared only against its own expectation, not lumped into one
 * combined figure that would not mean anything). Zero due, rather than
 * an error, when nobody has generated this period's records yet.
 */
export async function getCollectionSummary(): Promise<PlanCollectionSummary[]> {
  const plans = await prisma.contributionPlan.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    plans.map(async (plan) => {
      const period = computePeriod(plan.frequency);
      const aggregate = await prisma.contributionRecord.aggregate({
        where: { planId: plan.id, periodLabel: period.periodLabel },
        _sum: { amountDueKobo: true, amountPaidKobo: true },
      });
      const totalDueKobo = aggregate._sum.amountDueKobo ?? 0;
      const totalPaidKobo = aggregate._sum.amountPaidKobo ?? 0;
      const ratePercent = totalDueKobo > 0 ? (totalPaidKobo / totalDueKobo) * 100 : 0;
      return {
        planId: plan.id,
        planName: plan.name,
        periodLabel: period.periodLabel,
        totalDueKobo,
        totalPaidKobo,
        ratePercent,
      };
    }),
  );
}

export interface AttendanceTrendWeek {
  weekLabel: string;
  checkIns: number;
}

/** Total check-ins per week, oldest to newest, for the given number of trailing weeks (including the current, partial one). */
export async function getAttendanceTrend(weeksBack = 8): Promise<AttendanceTrendWeek[]> {
  const now = new Date();
  const weeks: AttendanceTrendWeek[] = [];

  for (let i = weeksBack - 1; i >= 0; i--) {
    const reference = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const period = computePeriod("WEEKLY", reference);
    const checkIns = await prisma.attendanceRecord.count({
      where: { checkedInAt: { gte: period.periodStart, lt: period.periodEnd } },
    });
    weeks.push({ weekLabel: period.periodLabel, checkIns });
  }

  return weeks;
}
