import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatNaira } from "@/lib/money";
import { getCharityDashboardData, resolveDashboardPeriod } from "@/lib/charity/dashboard-data";
import { getPreviousPeriod } from "@/lib/charity/period-comparison";
import { ZAKAT_CATEGORY_LABELS } from "@/lib/charity/zakat-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toLagosDateInputValue } from "@/lib/timezone";

// The Lagos calendar date, not the UTC one: a period starts at Lagos
// midnight, which is 23:00 UTC the day before, so the UTC date would show
// (and carry into the export and print links) the day before the period.
function toDateInputValue(date: Date): string {
  return toLagosDateInputValue(date);
}

export default async function CharityDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["CHARITY_OFFICER"]);
  const params = await searchParams;

  const period = resolveDashboardPeriod(params);
  const previousPeriod = getPreviousPeriod(period);
  const dashboardRows = await getCharityDashboardData(period);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-lg font-semibold">Charity dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Per fund and per period: opening balance, received, disbursed, closing balance and
            beneficiaries. This is the view for general meetings and donor questions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/admin/charity/funds">Manage funds</Link>} />
          <Button variant="outline" render={<Link href="/admin/charity/cases">Cases</Link>} />
          <Button variant="outline" render={<Link href="/admin/charity/disbursements/new">Disburse</Link>} />
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">From</Label>
              <Input type="date" name="from" defaultValue={toDateInputValue(period.from)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">To</Label>
              <Input type="date" name="to" defaultValue={toDateInputValue(period.to)} />
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {toDateInputValue(period.from)} to {toDateInputValue(period.to)}, compared with the equal-length
          period before it ({toDateInputValue(previousPeriod.from)} to{" "}
          {toDateInputValue(previousPeriod.to)})
        </p>
        <div className="flex gap-2 print:hidden">
          <Button
            variant="outline"
            render={
              <Link
                href={`/admin/charity/export?from=${toDateInputValue(period.from)}&to=${toDateInputValue(period.to)}`}
              >
                Export CSV
              </Link>
            }
          />
          <Button
            variant="outline"
            render={
              <Link
                href={`/admin/charity/print?from=${toDateInputValue(period.from)}&to=${toDateInputValue(period.to)}`}
              >
                Printable report
              </Link>
            }
          />
        </div>
      </div>

      {dashboardRows.map(({ fund, current, previous, zakatBreakdown }) => (
        <Card key={fund.id}>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {fund.name} <span className="text-xs font-normal text-muted-foreground">({fund.type})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="overflow-x-auto">
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
                    <td className="p-1 text-muted-foreground">{formatNaira(previous.openingBalanceKobo)}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-1">Received</td>
                    <td className="p-1">{formatNaira(current.receivedKobo)}</td>
                    <td className="p-1 text-muted-foreground">{formatNaira(previous.receivedKobo)}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-1">Disbursed</td>
                    <td className="p-1">{formatNaira(current.disbursedKobo)}</td>
                    <td className="p-1 text-muted-foreground">{formatNaira(previous.disbursedKobo)}</td>
                  </tr>
                  <tr className="border-t font-medium">
                    <td className="p-1">Closing balance</td>
                    <td className="p-1">{formatNaira(current.closingBalanceKobo)}</td>
                    <td className="p-1 font-normal text-muted-foreground">
                      {formatNaira(previous.closingBalanceKobo)}
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-1">Beneficiaries</td>
                    <td className="p-1">{current.beneficiaryCount}</td>
                    <td className="p-1 text-muted-foreground">{previous.beneficiaryCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {fund.type === "ZAKAT" ? (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Breakdown by category</p>
                {zakatBreakdown.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No zakat disbursements this period.</p>
                ) : (
                  <ul className="flex flex-col gap-0.5 text-sm">
                    {zakatBreakdown.map((row) => (
                      <li key={row.category} className="flex justify-between">
                        <span>{ZAKAT_CATEGORY_LABELS[row.category] ?? row.category}</span>
                        <span>
                          {formatNaira(row.totalKobo)} &middot; {row.beneficiaryCount} beneficiar
                          {row.beneficiaryCount === 1 ? "y" : "ies"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {dashboardRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No funds yet.{" "}
          <Link href="/admin/charity/funds" className="underline underline-offset-2">
            Add one
          </Link>{" "}
          to start tracking it.
        </p>
      ) : null}
    </div>
  );
}
