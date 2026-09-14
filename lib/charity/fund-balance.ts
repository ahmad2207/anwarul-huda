import { prisma } from "@/lib/prisma";

export interface FundBalancePeriod {
  /** Inclusive. Omit for "since the beginning". */
  from?: Date;
  /** Inclusive. Omit for "up to now". */
  to?: Date;
}

export interface FundBalance {
  fundId: string;
  fundName: string;
  openingBalanceKobo: number;
  receivedKobo: number;
  disbursedKobo: number;
  closingBalanceKobo: number;
  beneficiaryCount: number;
}

/**
 * A fund balance is always derived from payments in and disbursements
 * out, never stored as a mutable field (docs/SPEC.md 2.5, Phase 4 item
 * 1): there is no "balance" column anywhere to get out of sync with the
 * rows it should reflect. Voided payments never counted in the first
 * place (Payment.status is CONFIRMED only in every sum below), so
 * voiding one automatically corrects a fund's balance without this
 * function needing to know anything about voiding.
 */
export async function getFundBalance(fundId: string, period: FundBalancePeriod = {}): Promise<FundBalance> {
  const fund = await prisma.fund.findUniqueOrThrow({ where: { id: fundId } });

  const [openingReceived, openingDisbursed, periodReceived, periodDisbursed, beneficiaries] = await Promise.all([
    // Opening balance: everything before the period started. With no
    // "from", there is no prior period, so opening is simply zero and
    // these two queries are skipped rather than run unconstrained.
    period.from
      ? prisma.payment.aggregate({
          where: { fundId, status: "CONFIRMED", paidAt: { lt: period.from } },
          _sum: { amountKobo: true },
        })
      : null,
    period.from
      ? prisma.disbursement.aggregate({
          where: { fundId, paidAt: { lt: period.from } },
          _sum: { amountKobo: true },
        })
      : null,
    prisma.payment.aggregate({
      where: { fundId, status: "CONFIRMED", ...paidAtWithin(period) },
      _sum: { amountKobo: true },
    }),
    prisma.disbursement.aggregate({
      where: { fundId, ...paidAtWithin(period) },
      _sum: { amountKobo: true },
    }),
    prisma.disbursement.findMany({
      where: { fundId, ...paidAtWithin(period) },
      distinct: ["caseId"],
      select: { caseId: true },
    }),
  ]);

  const openingBalanceKobo = (openingReceived?._sum.amountKobo ?? 0) - (openingDisbursed?._sum.amountKobo ?? 0);
  const receivedKobo = periodReceived._sum.amountKobo ?? 0;
  const disbursedKobo = periodDisbursed._sum.amountKobo ?? 0;

  return {
    fundId: fund.id,
    fundName: fund.name,
    openingBalanceKobo,
    receivedKobo,
    disbursedKobo,
    closingBalanceKobo: openingBalanceKobo + receivedKobo - disbursedKobo,
    beneficiaryCount: beneficiaries.length,
  };
}

/** Exported for other charity report queries (lib/charity/zakat-breakdown.ts) that need the same period window. */
export function paidAtWithin(period: FundBalancePeriod): { paidAt: { gte?: Date; lte?: Date } } | Record<string, never> {
  if (!period.from && !period.to) return {};
  return {
    paidAt: {
      ...(period.from ? { gte: period.from } : {}),
      ...(period.to ? { lte: period.to } : {}),
    },
  };
}
