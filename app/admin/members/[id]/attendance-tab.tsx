import { getAttendanceRollup } from "@/lib/members/attendance-rollup";
import { getAttendanceLog, getAttendanceStats, type AttendanceLogRow } from "@/lib/members/member-view";
import { formatLagosDate, formatLagosDateTime } from "@/lib/timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { StatusTag } from "@/components/status-tag";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import type { AttendanceFilter } from "./attendance-filter";
import { CHECK_IN_METHOD_LABELS, GATHERING_TYPE_LABELS } from "./labels";
import { TabPager } from "./tab-pager";

const PAGE_SIZE = 25;

// MEMBER-HOME-AND-ADMIN-VIEW.md 2.2: the rollup answers "how often does
// this member attend", the log answers "what exactly happened". Both
// read the same period.
export async function AttendanceTab({
  member,
  filter,
  page,
}: {
  member: { id: string; wingId: string };
  filter: AttendanceFilter;
  page: number;
}) {
  const period = { from: filter.from, to: filter.to };
  const [rollup, stats, log] = await Promise.all([
    getAttendanceRollup(member, period),
    getAttendanceStats(member.id, period),
    getAttendanceLog(member.id, filter, { page, pageSize: PAGE_SIZE }),
  ]);

  const basePath = `/admin/members/${member.id}`;
  const linkParams: Record<string, string> = {
    tab: "attendance",
    from: filter.fromValue,
    to: filter.toValue,
    ...(filter.type ? { type: filter.type } : {}),
  };
  const exportHref = `${basePath}/attendance/export?${new URLSearchParams(linkParams).toString()}`;

  const totalCheckIns = Object.values(stats.methodCounts).reduce((sum, count) => sum + (count ?? 0), 0);
  const manualCheckIns = stats.methodCounts.MANUAL ?? 0;
  // The operational signal 2.2 asks for: checked in by hand every time,
  // with no face enrolment, is a member the office could offer to enrol.
  const alwaysByName = !stats.isFaceEnrolled && totalCheckIns > 0 && manualCheckIns === totalCheckIns;

  const columns: DataTableColumn<AttendanceLogRow>[] = [
    { key: "gathering", header: "Gathering", cell: (row) => row.gatheringTitle },
    { key: "type", header: "Type", cell: (row) => GATHERING_TYPE_LABELS[row.gatheringType] },
    { key: "date", header: "Date", cell: (row) => formatLagosDate(row.gatheringStartsAt) },
    { key: "checkedIn", header: "Checked in", cell: (row) => formatLagosDateTime(row.checkedInAt) },
    { key: "method", header: "Method", cell: (row) => CHECK_IN_METHOD_LABELS[row.method] },
    { key: "officer", header: "Recorded by", cell: (row) => row.recordedBy ?? "" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="attendance" />
            <FormField label="From" htmlFor="from">
              <Input id="from" name="from" type="date" defaultValue={filter.fromValue} />
            </FormField>
            <FormField label="To" htmlFor="to">
              <Input id="to" name="to" type="date" defaultValue={filter.toValue} />
            </FormField>
            <FormField label="Gathering type (log only)" htmlFor="type">
              <select
                id="type"
                name="type"
                defaultValue={filter.type ?? ""}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All types</option>
                {Object.entries(GATHERING_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Attended against held</CardTitle>
          </CardHeader>
          <CardContent>
            {rollup.length === 0 ? (
              <p className="text-sm text-muted-foreground">No gatherings were held for this member&apos;s wing in this period.</p>
            ) : (
              <dl className="flex flex-col gap-1 text-sm">
                {rollup.map((row) => (
                  <div key={row.type} className="flex justify-between gap-4">
                    <dt>{GATHERING_TYPE_LABELS[row.type]}</dt>
                    <dd className="font-mono tabular-nums">
                      {row.attended} of {row.held}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Held counts gatherings for {`this member's`} current wing and those open to all wings.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Last attended</dt>
                <dd>{stats.lastAttendedAt ? formatLagosDate(stats.lastAttendedAt) : "Never"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Longest gap in this period</dt>
                <dd>
                  {stats.longestGapDays === null
                    ? "Not enough check-ins"
                    : `${stats.longestGapDays} ${stats.longestGapDays === 1 ? "day" : "days"}`}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Face check-in</dt>
                <dd>{stats.isFaceEnrolled ? "Enrolled" : "Not enrolled"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Check-ins this period</dt>
                <dd>
                  {totalCheckIns === 0
                    ? "None"
                    : Object.entries(stats.methodCounts)
                        .map(([method, count]) => `${count} ${CHECK_IN_METHOD_LABELS[method as keyof typeof CHECK_IN_METHOD_LABELS].toLowerCase()}`)
                        .join(", ")}
                </dd>
              </div>
            </dl>
            {alwaysByName ? (
              <p className="mt-3">
                <StatusTag tone="attention">Checked in by name every time. Offer face enrolment at the mosque.</StatusTag>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Log</h2>
        <Button variant="outline" size="sm" render={<a href={exportHref}>Export CSV</a>} />
      </div>
      <DataTable columns={columns} rows={log.rows} rowKey={(row) => row.id} emptyMessage="No check-ins in this period." />
      <TabPager basePath={basePath} params={linkParams} pageParam="page" page={page} total={log.total} pageSize={PAGE_SIZE} />
    </div>
  );
}
