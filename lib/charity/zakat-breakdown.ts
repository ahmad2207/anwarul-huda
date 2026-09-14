import type { ZakatCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paidAtWithin } from "./fund-balance";
import type { FundBalancePeriod } from "./fund-balance";

export interface ZakatCategoryBreakdown {
  category: ZakatCategory;
  totalKobo: number;
  beneficiaryCount: number;
}

export const ZAKAT_CATEGORY_LABELS: Record<ZakatCategory, string> = {
  FUQARA: "Fuqara (the poor)",
  MASAKIN: "Masakin (the needy)",
  AMILIN: "Amilin (zakat administrators)",
  MUALLAFAT: "Muallafat (reconciled hearts)",
  RIQAB: "Riqab (freeing captives)",
  GHARIMIN: "Gharimin (those in debt)",
  FI_SABILILLAH: "Fi sabilillah (in the cause of Allah)",
  IBN_SABIL: "Ibn sabil (the stranded traveller)",
};

/**
 * How much a zakat fund disbursed in a period, broken down across the
 * eight zakat categories (docs/SPEC.md 2.5). Every disbursement counted
 * here already passed the zakat gate (lib/charity/record-disbursement.ts
 * and the database trigger), so every one has a category; this never
 * silently drops one into an "uncategorised" bucket.
 */
export async function getZakatBreakdown(
  fundId: string,
  period: FundBalancePeriod = {},
): Promise<ZakatCategoryBreakdown[]> {
  const disbursements = await prisma.disbursement.findMany({
    where: { fundId, ...paidAtWithin(period) },
    include: { case: { select: { zakatCategory: true } } },
  });

  const totals = new Map<ZakatCategory, { totalKobo: number; caseIds: Set<string> }>();

  for (const disbursement of disbursements) {
    const category = disbursement.case.zakatCategory;
    if (!category) continue;
    const existing = totals.get(category) ?? { totalKobo: 0, caseIds: new Set<string>() };
    existing.totalKobo += disbursement.amountKobo;
    existing.caseIds.add(disbursement.caseId);
    totals.set(category, existing);
  }

  return Array.from(totals.entries())
    .map(([category, data]) => ({
      category,
      totalKobo: data.totalKobo,
      beneficiaryCount: data.caseIds.size,
    }))
    .sort((a, b) => b.totalKobo - a.totalKobo);
}
