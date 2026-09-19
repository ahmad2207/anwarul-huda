import { requireRole } from "@/lib/auth";
import { formatNaira } from "@/lib/money";
import { getCharityDashboardData, resolveDashboardPeriod } from "@/lib/charity/dashboard-data";
import { getPreviousPeriod } from "@/lib/charity/period-comparison";
import { ZAKAT_CATEGORY_LABELS } from "@/lib/charity/zakat-breakdown";
import { BackLink } from "@/components/back-link";
import { PrintButton } from "./print-button";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

export default async function CharityPrintReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["CHARITY_OFFICER"]);
  const params = await searchParams;

  const period = resolveDashboardPeriod(params);
  const previousPeriod = getPreviousPeriod(period);
  const rows = await getCharityDashboardData(period);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <BackLink href="/admin/charity" label="Back to charity dashboard" className="print:hidden" />
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">Suitable for presenting at a general meeting.</p>
        <PrintButton />
      </div>

      <div className="text-center">
        <h1 className="text-xl font-semibold">Anwaru-l-Huda League of Nigeria</h1>
        <p className="text-sm text-muted-foreground">Charity funds committee report</p>
        <p className="text-sm text-muted-foreground">
          {formatDate(period.from)} to {formatDate(period.to)}
        </p>
      </div>

      {rows.length === 0 ? <p className="text-center text-sm text-muted-foreground">No funds yet.</p> : null}

      {rows.map(({ fund, current, previous, zakatBreakdown }) => (
        <div key={fund.id} className="flex flex-col gap-2 border-t pt-4">
          <h2 className="text-base font-semibold">
            {fund.name} ({fund.type})
          </h2>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-1 font-medium"></th>
                <th className="p-1 font-medium">This period</th>
                <th className="p-1 font-medium">Previous period</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-1">Opening balance</td>
                <td className="p-1">{formatNaira(current.openingBalanceKobo)}</td>
                <td className="p-1">{formatNaira(previous.openingBalanceKobo)}</td>
              </tr>
              <tr className="border-t">
                <td className="p-1">Received</td>
                <td className="p-1">{formatNaira(current.receivedKobo)}</td>
                <td className="p-1">{formatNaira(previous.receivedKobo)}</td>
              </tr>
              <tr className="border-t">
                <td className="p-1">Disbursed</td>
                <td className="p-1">{formatNaira(current.disbursedKobo)}</td>
                <td className="p-1">{formatNaira(previous.disbursedKobo)}</td>
              </tr>
              <tr className="border-t font-medium">
                <td className="p-1">Closing balance</td>
                <td className="p-1">{formatNaira(current.closingBalanceKobo)}</td>
                <td className="p-1 font-normal">{formatNaira(previous.closingBalanceKobo)}</td>
              </tr>
              <tr className="border-t">
                <td className="p-1">Beneficiaries</td>
                <td className="p-1">{current.beneficiaryCount}</td>
                <td className="p-1">{previous.beneficiaryCount}</td>
              </tr>
            </tbody>
          </table>

          {fund.type === "ZAKAT" && zakatBreakdown.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-1 font-medium">Zakat category</th>
                  <th className="p-1 font-medium">Amount</th>
                  <th className="p-1 font-medium">Beneficiaries</th>
                </tr>
              </thead>
              <tbody>
                {zakatBreakdown.map((row) => (
                  <tr key={row.category} className="border-t">
                    <td className="p-1">{ZAKAT_CATEGORY_LABELS[row.category] ?? row.category}</td>
                    <td className="p-1">{formatNaira(row.totalKobo)}</td>
                    <td className="p-1">{row.beneficiaryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ))}

      <p className="text-center text-xs text-muted-foreground">
        Compared with {formatDate(previousPeriod.from)} to {formatDate(previousPeriod.to)}.
      </p>
    </div>
  );
}
