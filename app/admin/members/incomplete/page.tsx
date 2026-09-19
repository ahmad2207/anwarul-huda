import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  getMemberProgressReport,
  PROGRESS_STATUSES,
  PROGRESS_STATUS_LABELS,
} from "@/lib/members/progress-report";
import type { MemberProgressRow, MemberProgressStatus } from "@/lib/members/progress-report";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { CompleteRecordForm } from "./complete-record-form";

const DEFAULT_STATUS: MemberProgressStatus = "NEVER_LOGGED_IN";

function isProgressStatus(value: string): value is MemberProgressStatus {
  return (PROGRESS_STATUSES as readonly string[]).includes(value);
}

export default async function MemberProgressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["WING_ADMIN"]);
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");
  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : "";
  // Never logged in is the default: MEMBER-INTERFACE.md 4 names it the
  // list the office chases, so it is what a wing administrator sees the
  // moment they open this page, not something they have to select.
  const status = isProgressStatus(statusParam) ? statusParam : DEFAULT_STATUS;

  const allRows = await getMemberProgressReport(isSuperAdmin ? null : user.wingIds);
  const rows = allRows.filter((row) => row.status === status);

  const columns: DataTableColumn<MemberProgressRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (row) => (
        <Link href={`/admin/members/${row.memberId}`} className="font-medium hover:underline">
          {row.displayName}
        </Link>
      ),
    },
    { key: "wing", header: "Wing", cell: (row) => row.wingName },
    { key: "memberNumber", header: "Member number", cell: (row) => row.memberNumber ?? "Not yet issued" },
    {
      key: "progress",
      header: "Record progress",
      cell: (row) => (
        <span>
          {row.completedCount} of {row.totalSections}
          {row.nextSectionLabel ? ` — next: ${row.nextSectionLabel}` : ""}
        </span>
      ),
    },
  ];

  // The admin-on-behalf-of fix (app/admin/members/incomplete/actions.ts)
  // only makes sense for a member who has never logged in and whose
  // record is genuinely still incomplete, never for someone already
  // engaging with their own record, so the action column only appears
  // here, and only for the rows it can actually act on.
  if (status === "NEVER_LOGGED_IN") {
    columns.push({
      key: "actions",
      header: "Actions",
      cell: (row) => (row.isRecordIncomplete ? <CompleteRecordForm memberId={row.memberId} /> : null),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Record progress"
        description="Where every member stands on their own nine-section record."
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/admin/members/bulk-issue-login">Bulk issue logins</Link>}
          />
        }
      />

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <FormField label="Status" htmlFor="status">
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {PROGRESS_STATUSES.map((option) => {
                  const count = allRows.filter((row) => row.status === option).length;
                  return (
                    <option key={option} value={option}>
                      {PROGRESS_STATUS_LABELS[option]} ({count})
                    </option>
                  );
                })}
              </select>
            </FormField>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} member{rows.length === 1 ? "" : "s"} &middot; {PROGRESS_STATUS_LABELS[status]}
        </p>
        <Button
          variant="outline"
          render={<Link href={`/admin/members/incomplete/export?status=${status}`}>Export CSV</Link>}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.memberId}
        emptyMessage="Nobody in this group."
        alignRowsTop
      />
    </div>
  );
}
