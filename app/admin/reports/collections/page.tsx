import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { groupCollections, loadCollectionsPayments } from "@/lib/reports/collections";
import type { CollectionsGroupBy } from "@/lib/reports/collections";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GROUP_OPTIONS: Array<{ value: CollectionsGroupBy; label: string }> = [
  { value: "period", label: "Period" },
  { value: "plan", label: "Plan or fund" },
  { value: "wing", label: "Wing" },
  { value: "officer", label: "Officer" },
  { value: "method", label: "Method" },
];

function parseDate(value: string | string[] | undefined): Date | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function CollectionsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["FINANCE_OFFICER"]);
  const params = await searchParams;

  const groupBy = (typeof params.groupBy === "string" ? params.groupBy : "period") as CollectionsGroupBy;
  const from = parseDate(params.from);
  const to = parseDate(params.to);
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Collections report</h1>
        <p className="text-sm text-muted-foreground">
          Confirmed payments, grouped by period, plan, wing, officer or method.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Group by</Label>
              <select
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
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">From</Label>
              <Input type="date" name="from" defaultValue={typeof params.from === "string" ? params.from : ""} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">To</Label>
              <Input type="date" name="to" defaultValue={typeof params.to === "string" ? params.to : ""} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Wing</Label>
              <select
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
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Plan</Label>
              <select
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
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Method</Label>
              <select
                name="method"
                defaultValue={method}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All methods</option>
                <option value="CASH">Cash</option>
                <option value="POS">POS</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
              </select>
            </div>
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

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-2 font-medium">{GROUP_OPTIONS.find((o) => o.value === groupBy)?.label}</th>
              <th className="p-2 font-medium">Payments</th>
              <th className="p-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b last:border-0">
                <td className="p-2">{row.label}</td>
                <td className="p-2">{row.count}</td>
                <td className="p-2">{formatNaira(row.totalKobo)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-4 text-center text-muted-foreground">
                  No confirmed payments match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
