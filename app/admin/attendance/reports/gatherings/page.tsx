import Link from "next/link";
import type { GatheringType } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getGatheringAttendanceReport, resolveWingFilter } from "@/lib/attendance/reports";
import type { GatheringReportRow, WingScope } from "@/lib/attendance/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { StatusTag } from "@/components/status-tag";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { formatLagosDate, parseLagosDayEnd, parseLagosDayStart } from "@/lib/timezone";

const TYPE_LABELS: Record<string, string> = {
  JUMUAH: "Jumu'ah",
  TALEEM: "Ta'leem",
  WING_MEETING: "Wing meeting",
  GENERAL_MEETING: "General meeting",
  PROGRAMME: "Programme",
  OTHER: "Other",
};

export default async function GatheringAttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");
  const scope: WingScope = canSeeAll ? null : user.wingIds;

  const params = await searchParams;
  const from = parseLagosDayStart(params.from);
  const to = parseLagosDayEnd(params.to);
  const type = typeof params.type === "string" && params.type ? (params.type as GatheringType) : undefined;
  const requestedWingId = typeof params.wingId === "string" ? params.wingId : undefined;
  const wingId = resolveWingFilter(requestedWingId, scope);

  const wings = await prisma.wing.findMany({
    where: scope ? { id: { in: scope } } : {},
    orderBy: { name: "asc" },
  });

  const rows = await getGatheringAttendanceReport({ from, to, type, wingId, scope });
  const totalCheckIns = rows.reduce((sum, row) => sum + row.checkedInCount, 0);

  const exportParams = new URLSearchParams();
  if (params.from && typeof params.from === "string") exportParams.set("from", params.from);
  if (params.to && typeof params.to === "string") exportParams.set("to", params.to);
  if (type) exportParams.set("type", type);
  if (wingId) exportParams.set("wingId", wingId);

  const columns: DataTableColumn<GatheringReportRow>[] = [
    {
      key: "gathering",
      header: "Gathering",
      cell: (row) => (
        <Link href={`/admin/attendance/${row.gatheringId}`} className="font-medium hover:underline">
          {row.title}
        </Link>
      ),
    },
    { key: "type", header: "Type", cell: (row) => TYPE_LABELS[row.type] ?? row.type },
    { key: "wing", header: "Wing", cell: (row) => row.wingName },
    { key: "date", header: "Date", cell: (row) => formatLagosDate(row.startsAt) },
    { key: "checkedIn", header: "Checked in", cell: (row) => row.checkedInCount },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusTag tone="neutral">{row.isClosed ? "Closed" : "Open"}</StatusTag>,
    },
    {
      key: "attendees",
      header: "",
      cell: (row) => (
        <Link href={`/admin/attendance/reports/gatherings/${row.gatheringId}`} className="text-sm hover:underline">
          Attendees
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Attendance per gathering" description="How many members checked in to each gathering." />

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
            <FormField label="Type" htmlFor="type">
              <select
                id="type"
                name="type"
                defaultValue={type ?? ""}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All types</option>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            {wings.length > 1 ? (
              <FormField label="Wing" htmlFor="wingId">
                <select
                  id="wingId"
                  name="wingId"
                  defaultValue={wingId ?? ""}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">All wings</option>
                  {wings.map((wing) => (
                    <option key={wing.id} value={wing.id}>
                      {wing.name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} gathering{rows.length === 1 ? "" : "s"} &middot; {totalCheckIns} total check-in
          {totalCheckIns === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          render={<Link href={`/admin/attendance/reports/gatherings/export?${exportParams.toString()}`}>Export CSV</Link>}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.gatheringId}
        emptyMessage="No gatherings match this filter."
      />
    </div>
  );
}
