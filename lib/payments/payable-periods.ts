import type { Frequency, Prisma, PrismaClient } from "@prisma/client";
import { computePeriod } from "@/lib/contributions/period";

export interface PayablePeriod {
  periodLabel: string;
  /** What is still owed for this period, in kobo. Zero for a current period already paid in full. */
  outstandingKobo: number;
  isCurrent: boolean;
}

/**
 * The periods a payment against this plan can settle for this member,
 * oldest first: every earlier period still owing something (arrears),
 * then the current period, which is always offered. The officer's form
 * defaults to the first entry, so the oldest debt is settled first unless
 * the officer deliberately picks another.
 */
export async function listPayablePeriods(
  db: PrismaClient | Prisma.TransactionClient,
  memberId: string,
  plan: { id: string; frequency: Frequency; amountKobo: number },
  now: Date = new Date(),
): Promise<PayablePeriod[]> {
  const current = computePeriod(plan.frequency, now);

  const records = await db.contributionRecord.findMany({
    where: { memberId, planId: plan.id },
    orderBy: { periodStart: "asc" },
    select: { periodLabel: true, amountDueKobo: true, amountPaidKobo: true },
  });

  const arrears = records
    .filter((record) => record.periodLabel !== current.periodLabel && record.amountPaidKobo < record.amountDueKobo)
    .map((record) => ({
      periodLabel: record.periodLabel,
      outstandingKobo: record.amountDueKobo - record.amountPaidKobo,
      isCurrent: false,
    }));

  const currentRecord = records.find((record) => record.periodLabel === current.periodLabel);
  const currentOutstanding = currentRecord
    ? Math.max(0, currentRecord.amountDueKobo - currentRecord.amountPaidKobo)
    : plan.amountKobo;

  return [...arrears, { periodLabel: current.periodLabel, outstandingKobo: currentOutstanding, isCurrent: true }];
}
