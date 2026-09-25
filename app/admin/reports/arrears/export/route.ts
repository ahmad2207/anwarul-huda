import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { koboToNaira } from "@/lib/money";
import { toCsvDocument } from "@/lib/csv";
import { getArrearsReport } from "@/lib/reports/arrears";
import { withRouteAuth } from "@/lib/route-auth";

async function handleGet(request: NextRequest) {
  await requireRole(["FINANCE_OFFICER"]);

  const wingId = request.nextUrl.searchParams.get("wingId") || undefined;
  const rows = await getArrearsReport(wingId);

  const csv = toCsvDocument(
    ["Member", "Member number", "Wing", "Unpaid periods", "Outstanding (Naira)"],
    rows.map((row) => [
      `${row.surname} ${row.firstName}`,
      row.memberNumber ?? "",
      row.wingName,
      String(row.recordCount),
      koboToNaira(row.outstandingKobo).toFixed(2),
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="arrears-report.csv"',
    },
  });
}

export const GET = withRouteAuth(handleGet);
