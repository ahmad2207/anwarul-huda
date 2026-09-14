import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLagosDateParts } from "@/lib/timezone";

export type CollectionsGroupBy = "period" | "plan" | "wing" | "officer" | "method";

export interface CollectionsFilter {
  from?: Date;
  to?: Date;
  wingId?: string;
  planId?: string;
  method?: PaymentMethod;
}

export interface CollectionsPayment {
  amountKobo: number;
  paidAt: Date;
  planId: string | null;
  planName: string | null;
  fundId: string | null;
  fundName: string | null;
  wingId: string;
  wingName: string;
  collectedById: string;
  collectedByLabel: string;
  method: PaymentMethod;
}

export interface CollectionsRow {
  key: string;
  label: string;
  totalKobo: number;
  count: number;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  POS: "POS",
  BANK_TRANSFER: "Bank transfer",
};

/**
 * Groups and sums confirmed payments by one of the five dimensions Phase
 * 3 asks for. A pure function over already-loaded payments, kept separate
 * from the database fetch below so the grouping and summing logic (where
 * a money mistake would actually matter) can be unit tested directly.
 */
export function groupCollections(
  payments: CollectionsPayment[],
  groupBy: CollectionsGroupBy,
): CollectionsRow[] {
  const groups = new Map<string, CollectionsRow>();

  for (const payment of payments) {
    const { key, label } = groupKey(payment, groupBy);
    const existing = groups.get(key);
    if (existing) {
      existing.totalKobo += payment.amountKobo;
      existing.count += 1;
    } else {
      groups.set(key, { key, label, totalKobo: payment.amountKobo, count: 1 });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.totalKobo - a.totalKobo);
}

function groupKey(payment: CollectionsPayment, groupBy: CollectionsGroupBy): { key: string; label: string } {
  switch (groupBy) {
    case "period": {
      const { year, month } = getLagosDateParts(payment.paidAt);
      const label = `${year}-${String(month).padStart(2, "0")}`;
      return { key: label, label };
    }
    case "plan": {
      if (payment.planId) return { key: `plan:${payment.planId}`, label: payment.planName ?? "Unnamed plan" };
      if (payment.fundId) return { key: `fund:${payment.fundId}`, label: `Fund: ${payment.fundName ?? "Unnamed"}` };
      return { key: "none", label: "General" };
    }
    case "wing":
      return { key: payment.wingId, label: payment.wingName };
    case "officer":
      return { key: payment.collectedById, label: payment.collectedByLabel };
    case "method":
      return { key: payment.method, label: METHOD_LABELS[payment.method] };
  }
}

/** Loads confirmed payments matching the filter, ready for groupCollections. */
export async function loadCollectionsPayments(filter: CollectionsFilter): Promise<CollectionsPayment[]> {
  const payments = await prisma.payment.findMany({
    where: {
      status: "CONFIRMED",
      ...(filter.from || filter.to
        ? { paidAt: { gte: filter.from, lte: filter.to } }
        : {}),
      ...(filter.wingId ? { member: { wingId: filter.wingId } } : {}),
      ...(filter.planId ? { planId: filter.planId } : {}),
      ...(filter.method ? { method: filter.method } : {}),
    },
    include: {
      member: { include: { wing: true } },
      plan: true,
      fund: true,
      collectedBy: true,
    },
  });

  return payments.map((payment) => ({
    amountKobo: payment.amountKobo,
    paidAt: payment.paidAt,
    planId: payment.planId,
    planName: payment.plan?.name ?? null,
    fundId: payment.fundId,
    fundName: payment.fund?.name ?? null,
    wingId: payment.member.wingId,
    wingName: payment.member.wing.name,
    collectedById: payment.collectedById,
    collectedByLabel: payment.collectedBy.email ?? payment.collectedBy.phone ?? "Unknown",
    method: payment.method,
  }));
}
