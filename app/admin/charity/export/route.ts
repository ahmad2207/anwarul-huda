import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { koboToNaira } from "@/lib/money";
import { toCsvDocument } from "@/lib/csv";
import { getCharityDashboardData, resolveDashboardPeriod } from "@/lib/charity/dashboard-data";
import { ZAKAT_CATEGORY_LABELS } from "@/lib/charity/zakat-breakdown";

export async function GET(request: NextRequest) {
  await requireRole(["CHARITY_OFFICER"]);

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const period = resolveDashboardPeriod(params);
  const rows = await getCharityDashboardData(period);

  const naira = (kobo: number) => koboToNaira(kobo).toFixed(2);

  const csvRows: string[][] = [];
  for (const row of rows) {
    csvRows.push([
      row.fund.name,
      row.fund.type,
      naira(row.current.openingBalanceKobo),
      naira(row.current.receivedKobo),
      naira(row.current.disbursedKobo),
      naira(row.current.closingBalanceKobo),
      String(row.current.beneficiaryCount),
      "",
    ]);
    for (const category of row.zakatBreakdown) {
      csvRows.push([
        row.fund.name,
        row.fund.type,
        "",
        "",
        naira(category.totalKobo),
        "",
        String(category.beneficiaryCount),
        ZAKAT_CATEGORY_LABELS[category.category] ?? category.category,
      ]);
    }
  }

  const csv = toCsvDocument(
    [
      "Fund",
      "Type",
      "Opening balance (Naira)",
      "Received (Naira)",
      "Disbursed (Naira)",
      "Closing balance (Naira)",
      "Beneficiaries",
      "Zakat category",
    ],
    csvRows,
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="charity-committee-report.csv"',
    },
  });
}
