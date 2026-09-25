import Link from "next/link";
import { getMemberContributions, getMemberMoneyTotals, getMemberPayments, staffLabel } from "@/lib/members/member-view";
import { formatLagosDate } from "@/lib/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/money";
import { StatusTag } from "@/components/status-tag";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { PAYMENT_METHOD_LABELS } from "./labels";
import { TabPager } from "./tab-pager";

const PAGE_SIZE = 20;

type PaymentRow = Awaited<ReturnType<typeof getMemberPayments>>["payments"][number];
type ContributionRow = Awaited<ReturnType<typeof getMemberContributions>>["records"][number];

// MEMBER-HOME-AND-ADMIN-VIEW.md 2.3. A voided payment stays in the list,
// in date order, marked voided with its reason and who voided it. It is
// never hidden and never counts towards the total paid.
export async function PaymentsTab({
  memberId,
  page,
  contributionsPage,
}: {
  memberId: string;
  page: number;
  contributionsPage: number;
}) {
  const [{ payments, total }, { records, total: recordsTotal }, totals] = await Promise.all([
    getMemberPayments(memberId, { page, pageSize: PAGE_SIZE }),
    getMemberContributions(memberId, { page: contributionsPage, pageSize: PAGE_SIZE }),
    getMemberMoneyTotals(memberId),
  ]);

  const basePath = `/admin/members/${memberId}`;
  const linkParams = { tab: "payments", page: String(page), cpage: String(contributionsPage) };

  const paymentColumns: DataTableColumn<PaymentRow>[] = [
    { key: "date", header: "Date", cell: (row) => formatLagosDate(row.paidAt) },
    {
      key: "receipt",
      header: "Receipt",
      cell: (row) => (
        <Link href={`/admin/payments/${row.id}`} className="font-mono underline-offset-2 hover:underline">
          {row.receiptNumber}
        </Link>
      ),
    },
    { key: "for", header: "Plan or fund", cell: (row) => row.plan?.name ?? row.fund?.name ?? "Other" },
    { key: "method", header: "Method", cell: (row) => PAYMENT_METHOD_LABELS[row.method] ?? row.method },
    { key: "collectedBy", header: "Collected by", cell: (row) => staffLabel(row.collectedBy) },
    { key: "session", header: "Cash session", cell: (row) => row.cashSession?.label ?? "" },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (row) => <Money kobo={row.amountKobo} className={row.status === "VOIDED" ? "line-through text-muted-foreground" : ""} />,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) =>
        row.status === "VOIDED" ? (
          <div className="flex flex-col gap-0.5">
            <StatusTag tone="alert">Voided</StatusTag>
            <span className="text-xs text-muted-foreground">
              {row.voidReason ?? "No reason recorded"}. By {staffLabel(row.voidedBy)}
              {row.voidedAt ? `, ${formatLagosDate(row.voidedAt)}` : ""}
            </span>
          </div>
        ) : (
          <StatusTag tone="confirmed">Confirmed</StatusTag>
        ),
    },
  ];

  const contributionColumns: DataTableColumn<ContributionRow>[] = [
    { key: "plan", header: "Plan", cell: (row) => row.plan.name },
    { key: "period", header: "Period", cell: (row) => row.periodLabel },
    { key: "due", header: "Due", align: "right", cell: (row) => <Money kobo={row.amountDueKobo} /> },
    { key: "paid", header: "Paid", align: "right", cell: (row) => <Money kobo={row.amountPaidKobo} /> },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      cell: (row) => <Money kobo={Math.max(0, row.amountDueKobo - row.amountPaidKobo)} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total paid, all time</p>
            <Money kobo={totals.totalPaidKobo} className="text-left text-2xl font-semibold" />
            <p className="text-xs text-muted-foreground">Confirmed payments only. Voided payments are not counted.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Current arrears</p>
            <Money kobo={totals.arrearsKobo} className="text-left text-2xl font-semibold" />
            <p className="text-xs text-muted-foreground">Outstanding across every contribution period.</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-base font-medium">Payments</h2>
      <DataTable
        columns={paymentColumns}
        rows={payments}
        rowKey={(row) => row.id}
        emptyMessage="No payments recorded for this member."
        alignRowsTop
      />
      <TabPager basePath={basePath} params={linkParams} pageParam="page" page={page} total={total} pageSize={PAGE_SIZE} />

      <h2 className="text-base font-medium">Contributions</h2>
      <DataTable
        columns={contributionColumns}
        rows={records}
        rowKey={(row) => row.id}
        emptyMessage="No contribution records have been generated for this member."
      />
      <TabPager
        basePath={basePath}
        params={linkParams}
        pageParam="cpage"
        page={contributionsPage}
        total={recordsTotal}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
