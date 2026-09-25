import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { koboToNaira } from "@/lib/money";
import { toCsvDocument } from "@/lib/csv";
import { groupCollections, loadCollectionsPayments } from "@/lib/reports/collections";
import type { CollectionsGroupBy } from "@/lib/reports/collections";
import { withRouteAuth } from "@/lib/route-auth";

async function handleGet(request: NextRequest) {
  await requireRole(["FINANCE_OFFICER"]);

  const params = request.nextUrl.searchParams;
  const groupBy = (params.get("groupBy") || "period") as CollectionsGroupBy;
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const wingId = params.get("wingId") || undefined;
  const planId = params.get("planId") || undefined;
  const method = (params.get("method") || undefined) as "CASH" | "POS" | "BANK_TRANSFER" | undefined;

  const payments = await loadCollectionsPayments({
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
    wingId,
    planId,
    method,
  });
  const rows = groupCollections(payments, groupBy);

  const csv = toCsvDocument(
    ["Group", "Payments", "Total (Naira)"],
    rows.map((row) => [row.label, String(row.count), koboToNaira(row.totalKobo).toFixed(2)]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="collections-report.csv"',
    },
  });
}

export const GET = withRouteAuth(handleGet);
