import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { getArrearsReport } from "@/lib/reports/arrears";
import type { ArrearsRow } from "@/lib/reports/arrears";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { MemberNumber } from "@/components/member-number";
import { Money } from "@/components/money";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";

export default async function ArrearsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["FINANCE_OFFICER"]);
  const params = await searchParams;
  const wingId = typeof params.wingId === "string" ? params.wingId : "";

  const wings = await prisma.wing.findMany({ orderBy: { name: "asc" } });
  const rows = await getArrearsReport(wingId || undefined);
  const totalOutstandingKobo = rows.reduce((sum, row) => sum + row.outstandingKobo, 0);

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
        description="Active members with an unpaid balance on at least one contribution record."
      />

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
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
          {rows.length} member{rows.length === 1 ? "" : "s"} in arrears &middot; total outstanding{" "}
          {formatNaira(totalOutstandingKobo)}
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

      <DataTable columns={columns} rows={rows} rowKey={(row) => row.memberId} emptyMessage="Nobody is in arrears." />
    </div>
  );
}
