import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { groupCollections, loadCollectionsPayments } from "@/lib/reports/collections";
import type { CollectionsGroupBy, CollectionsRow } from "@/lib/reports/collections";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { Money } from "@/components/money";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { parseLagosDayEnd, parseLagosDayStart } from "@/lib/timezone";

const GROUP_OPTIONS: Array<{ value: CollectionsGroupBy; label: string }> = [
  { value: "period", label: "Period" },
  { value: "plan", label: "Plan or fund" },
  { value: "wing", label: "Wing" },
  { value: "officer", label: "Officer" },
  { value: "method", label: "Method" },
];

export default async function CollectionsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["FINANCE_OFFICER"]);
  const params = await searchParams;

  const groupBy = (typeof params.groupBy === "string" ? params.groupBy : "period") as CollectionsGroupBy;
  const from = parseLagosDayStart(params.from);
  const to = parseLagosDayEnd(params.to);
  const wingId = typeof params.wingId === "string" ? params.wingId : "";
  const planId = typeof params.planId === "string" ? params.planId : "";
  const method = typeof params.method === "string" ? params.method : "";

  const [wings, plans] = await Promise.all([
    prisma.wing.findMany({ orderBy: { name: "asc" } }),
    prisma.contributionPlan.findMany({ orderBy: { name: "asc" } }),
  ]);

  const filter = {
    from,
    to,
    wingId: wingId || undefined,
    planId: planId || undefined,
    method: (method || undefined) as "CASH" | "POS" | "BANK_TRANSFER" | undefined,
  };

  const payments = await loadCollectionsPayments(filter);
  const rows = groupCollections(payments, groupBy);
  const grandTotalKobo = rows.reduce((sum, row) => sum + row.totalKobo, 0);

  const exportParams = new URLSearchParams();
  exportParams.set("groupBy", groupBy);
  if (params.from && typeof params.from === "string") exportParams.set("from", params.from);
  if (params.to && typeof params.to === "string") exportParams.set("to", params.to);
  if (wingId) exportParams.set("wingId", wingId);
  if (planId) exportParams.set("planId", planId);
  if (method) exportParams.set("method", method);

  const columns: DataTableColumn<CollectionsRow>[] = [
    { key: "label", header: GROUP_OPTIONS.find((o) => o.value === groupBy)?.label, cell: (row) => row.label },
    { key: "count", header: "Payments", cell: (row) => row.count },
    { key: "total", header: "Total", align: "right", cell: (row) => <Money kobo={row.totalKobo} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Collections report"
        description="Confirmed payments, grouped by period, plan, wing, officer or method."
      />

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <FormField label="Group by" htmlFor="groupBy">
              <select
                id="groupBy"
                name="groupBy"
                defaultValue={groupBy}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
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
            <FormField label="Plan" htmlFor="planId">
              <select
                id="planId"
                name="planId"
                defaultValue={planId}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All plans</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Method" htmlFor="method">
              <select
                id="method"
                name="method"
                defaultValue={method}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All methods</option>
                <option value="CASH">Cash</option>
                <option value="POS">POS</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
              </select>
            </FormField>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} group{rows.length === 1 ? "" : "s"} &middot; total {formatNaira(grandTotalKobo)}
        </p>
        <Button
          variant="outline"
          render={<Link href={`/admin/reports/collections/export?${exportParams.toString()}`}>Export CSV</Link>}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        emptyMessage="No confirmed payments match this filter."
      />
    </div>
  );
}
