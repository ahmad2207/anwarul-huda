import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { getWingAttendanceRates } from "@/lib/attendance/reports";
import type { WingAttendanceRateRow, WingScope } from "@/lib/attendance/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";

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

  const columns: DataTableColumn<WingAttendanceRateRow>[] = [
    { key: "wing", header: "Wing", cell: (row) => <span className="font-medium">{row.wingName}</span> },
    { key: "gatherings", header: "Gatherings held", cell: (row) => row.gatheringsHeld },
    { key: "checkIns", header: "Total check-ins", cell: (row) => row.totalCheckIns },
    { key: "activeMembers", header: "Active members", cell: (row) => row.activeMemberCount },
    { key: "rate", header: "Rate", cell: (row) => `${row.ratePercent.toFixed(1)}%` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Attendance rate per wing"
        description="Total check-ins divided by gatherings held times active members: on average, what share of the wing shows up. Measured against currently active members."
      />

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <FormField label="From" htmlFor="from">
              <Input
                id="from"
                type="date"
                name="from"
                defaultValue={typeof params.from === "string" ? params.from : ""}
              />
            </FormField>
            <FormField label="To" htmlFor="to">
              <Input id="to" type="date" name="to" defaultValue={typeof params.to === "string" ? params.to : ""} />
            </FormField>
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

      <DataTable columns={columns} rows={rows} rowKey={(row) => row.wingId} emptyMessage="No wings in view." />
    </div>
  );
}
