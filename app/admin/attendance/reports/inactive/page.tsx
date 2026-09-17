import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getMembersNotAttendedSince, resolveWingFilter } from "@/lib/attendance/reports";
import type { InactiveMemberRow, WingScope } from "@/lib/attendance/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { MemberNumber } from "@/components/member-number";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { formatMemberName } from "@/lib/members/display-name";

const PAGE_SIZE = 20;
const DEFAULT_WEEKS = 4;

export default async function InactiveMembersReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");
  const scope: WingScope = canSeeAll ? null : user.wingIds;

  const params = await searchParams;
  const weeks = Math.max(1, Number(typeof params.weeks === "string" ? params.weeks : String(DEFAULT_WEEKS)) || DEFAULT_WEEKS);
  const requestedWingId = typeof params.wingId === "string" ? params.wingId : undefined;
  const wingId = resolveWingFilter(requestedWingId, scope);
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

  const wings = await prisma.wing.findMany({
    where: scope ? { id: { in: scope } } : {},
    orderBy: { name: "asc" },
  });

  const { rows, total } = await getMembersNotAttendedSince({ cutoff, scope, wingId, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    next.set("weeks", String(weeks));
    if (wingId) next.set("wingId", wingId);
    next.set("page", String(targetPage));
    return `/admin/attendance/reports/inactive?${next.toString()}`;
  }

  const exportParams = new URLSearchParams();
  exportParams.set("weeks", String(weeks));
  if (wingId) exportParams.set("wingId", wingId);

  const columns: DataTableColumn<InactiveMemberRow>[] = [
    {
      key: "member",
      header: "Member",
      cell: (row) => (
        <Link href={`/admin/members/${row.memberId}`} className="font-medium hover:underline">
          {formatMemberName(row)}
        </Link>
      ),
    },
    { key: "memberNumber", header: "Member number", cell: (row) => <MemberNumber value={row.memberNumber} /> },
    { key: "wing", header: "Wing", cell: (row) => row.wingName },
    {
      key: "lastAttended",
      header: "Last attended",
      cell: (row) => (row.lastAttendedAt ? row.lastAttendedAt.toLocaleDateString("en-NG") : "Never"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Not attended recently"
        description="Active members who have not attended anything in the given number of weeks, including those who have never attended."
      />

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <FormField label="Weeks" htmlFor="weeks">
              <Input id="weeks" type="number" name="weeks" min={1} defaultValue={weeks} className="w-24" />
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
          {total} member{total === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          render={<Link href={`/admin/attendance/reports/inactive/export?${exportParams.toString()}`}>Export CSV</Link>}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.memberId}
        emptyMessage="Everyone in view has attended within the given period."
      />

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              render={<Link href={pageHref(Math.max(1, page - 1))}>Previous</Link>}
            />
            <Button
              variant="outline"
              disabled={page >= totalPages}
              render={<Link href={pageHref(Math.min(totalPages, page + 1))}>Next</Link>}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
