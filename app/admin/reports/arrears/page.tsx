import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { getArrearsReport, getArrearsSummary } from "@/lib/reports/arrears";
import type { ArrearsRow } from "@/lib/reports/arrears";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { MemberNumber } from "@/components/member-number";
import { Money } from "@/components/money";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";

const PAGE_SIZE = 50;

export default async function ArrearsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["FINANCE_OFFICER"]);
  const params = await searchParams;
  const wingId = typeof params.wingId === "string" ? params.wingId : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const [wings, rows, summary] = await Promise.all([
    prisma.wing.findMany({ orderBy: { name: "asc" } }),
    getArrearsReport(wingId || undefined, { search: q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    getArrearsSummary(wingId || undefined, { search: q }),
  ]);
  const totalPages = Math.max(1, Math.ceil(summary.memberCount / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (wingId) next.set("wingId", wingId);
    if (q) next.set("q", q);
    next.set("page", String(targetPage));
    return `/admin/reports/arrears?${next.toString()}`;
  }

  const columns: DataTableColumn<ArrearsRow>[] = [
    {
      key: "member",
      header: "Member",
      cell: (row) => (
        <Link href={`/admin/members/${row.memberId}`} className="font-medium hover:underline">
          {row.surname} {row.firstName}
        </Link>
      ),
    },
    { key: "memberNumber", header: "Member number", cell: (row) => <MemberNumber value={row.memberNumber} /> },
    { key: "wing", header: "Wing", cell: (row) => row.wingName },
    { key: "unpaidPeriods", header: "Unpaid periods", cell: (row) => row.recordCount },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      cell: (row) => <Money kobo={row.outstandingKobo} className="font-medium text-amber-800" />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Arrears"
        description="Active members with an unpaid balance on a contribution period that has ended. The period still running is not counted."
      />

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <FormField label="Search" htmlFor="q">
              <Input id="q" name="q" defaultValue={q} placeholder="Name or member number" className="w-64" />
            </FormField>
            <FormField label="Wing" htmlFor="wingId">
              <select
                id="wingId"
                name="wingId"
                defaultValue={wingId}
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
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {summary.memberCount} member{summary.memberCount === 1 ? "" : "s"} in arrears &middot; total outstanding{" "}
          {formatNaira(summary.outstandingKobo)}
        </p>
        <Button
          variant="outline"
          render={
            <Link href={`/admin/reports/arrears/export${wingId ? `?wingId=${wingId}` : ""}`}>
              Export CSV
            </Link>
          }
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.memberId}
        emptyMessage={q ? "Nobody in arrears matches this search." : "Nobody is in arrears."}
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
