import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatNaira } from "@/lib/money";
import { getAttendanceTrend, getCollectionSummary, getMembershipSummary } from "@/lib/dashboard/executive-summary";
import { getCharityDashboardData, resolveDashboardPeriod } from "@/lib/charity/dashboard-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// The one page the committee can look at (Phase 7 item 2): a summary of
// four things each already have their own detailed view elsewhere in the
// app, brought onto a single page rather than duplicated in depth here.
// Super admin only: every other role's own view is already scoped to its
// own wing or its own section, and this page deliberately is not.
export default async function AdminHomePage() {
  await requireRole(["SUPER_ADMIN"]);

  const [membership, collections, attendanceTrend, funds] = await Promise.all([
    getMembershipSummary(),
    getCollectionSummary(),
    getAttendanceTrend(8),
    getCharityDashboardData(resolveDashboardPeriod({})),
  ]);

  const totalActive = membership.reduce((sum, row) => sum + row.activeCount, 0);
  const totalNewThisMonth = membership.reduce((sum, row) => sum + row.newThisMonth, 0);
  const maxCheckIns = Math.max(1, ...attendanceTrend.map((week) => week.checkIns));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          {totalActive} active members &middot; {totalNewThisMonth} new this month
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Membership per wing</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-1 font-medium">Wing</th>
                <th className="p-1 font-medium">Active</th>
                <th className="p-1 font-medium">New this month</th>
              </tr>
            </thead>
            <tbody>
              {membership.map((row) => (
                <tr key={row.wingId} className="border-t">
                  <td className="p-1">{row.wingName}</td>
                  <td className="p-1">{row.activeCount}</td>
                  <td className="p-1">{row.newThisMonth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Contribution collection, this period</CardTitle>
        </CardHeader>
        <CardContent>
          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active contribution plans.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-1 font-medium">Plan</th>
                  <th className="p-1 font-medium">Period</th>
                  <th className="p-1 font-medium">Expected</th>
                  <th className="p-1 font-medium">Collected</th>
                  <th className="p-1 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((row) => (
                  <tr key={row.planId} className="border-t">
                    <td className="p-1">{row.planName}</td>
                    <td className="p-1 text-muted-foreground">{row.periodLabel}</td>
                    <td className="p-1">{formatNaira(row.totalDueKobo)}</td>
                    <td className="p-1">{formatNaira(row.totalPaidKobo)}</td>
                    <td className="p-1">
                      {row.totalDueKobo > 0 ? `${row.ratePercent.toFixed(0)}%` : "Not generated yet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Fund balances, this month</CardTitle>
          <Button variant="outline" size="sm" render={<Link href="/admin/charity">Open charity dashboard</Link>} />
        </CardHeader>
        <CardContent>
          {funds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No funds yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-1 font-medium">Fund</th>
                  <th className="p-1 font-medium">Received</th>
                  <th className="p-1 font-medium">Disbursed</th>
                  <th className="p-1 font-medium">Closing balance</th>
                </tr>
              </thead>
              <tbody>
                {funds.map(({ fund, current }) => (
                  <tr key={fund.id} className="border-t">
                    <td className="p-1">{fund.name}</td>
                    <td className="p-1">{formatNaira(current.receivedKobo)}</td>
                    <td className="p-1">{formatNaira(current.disbursedKobo)}</td>
                    <td className="p-1 font-medium">{formatNaira(current.closingBalanceKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Attendance trend, last 8 weeks</CardTitle>
          <Button variant="outline" size="sm" render={<Link href="/admin/attendance/reports">Open reports</Link>} />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            {attendanceTrend.map((week) => (
              <div key={week.weekLabel} className="flex items-center gap-2 text-sm">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">{week.weekLabel}</span>
                <div className="h-4 flex-1 rounded bg-muted">
                  <div
                    className="h-4 rounded bg-primary"
                    style={{ width: `${(week.checkIns / maxCheckIns) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right">{week.checkIns}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
