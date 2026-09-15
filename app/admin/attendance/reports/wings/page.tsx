import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { getWingAttendanceRates } from "@/lib/attendance/reports";
import type { WingScope } from "@/lib/attendance/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function WingAttendanceRatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");
  const scope: WingScope = canSeeAll ? null : user.wingIds;

  const params = await searchParams;
  const from = typeof params.from === "string" && params.from ? new Date(params.from) : undefined;
  const to = typeof params.to === "string" && params.to ? new Date(params.to) : undefined;

  const rows = await getWingAttendanceRates({ from, to, scope });

  const exportParams = new URLSearchParams();
  if (params.from && typeof params.from === "string") exportParams.set("from", params.from);
  if (params.to && typeof params.to === "string") exportParams.set("to", params.to);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Attendance rate per wing</h1>
        <p className="text-sm text-muted-foreground">
          Total check-ins divided by gatherings held times active members: on average, what share of the
          wing shows up. Measured against currently active members.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">From</Label>
              <Input type="date" name="from" defaultValue={typeof params.from === "string" ? params.from : ""} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">To</Label>
              <Input type="date" name="to" defaultValue={typeof params.to === "string" ? params.to : ""} />
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          render={<Link href={`/admin/attendance/reports/wings/export?${exportParams.toString()}`}>Export CSV</Link>}
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-2 font-medium">Wing</th>
              <th className="p-2 font-medium">Gatherings held</th>
              <th className="p-2 font-medium">Total check-ins</th>
              <th className="p-2 font-medium">Active members</th>
              <th className="p-2 font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.wingId} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2 font-medium">{row.wingName}</td>
                <td className="p-2">{row.gatheringsHeld}</td>
                <td className="p-2">{row.totalCheckIns}</td>
                <td className="p-2">{row.activeMemberCount}</td>
                <td className="p-2">{row.ratePercent.toFixed(1)}%</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  No wings in view.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
