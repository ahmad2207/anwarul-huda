import Link from "next/link";
import type { Payment, ContributionPlan, Fund, Member, Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Money } from "@/components/money";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { StatusTag } from "@/components/status-tag";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { formatLagosDate } from "@/lib/timezone";

type PaymentRow = Payment & { member: Member; plan: ContributionPlan | null; fund: Fund | null };

const PAGE_SIZE = 25;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["FINANCE_OFFICER"]);
  const params = await searchParams;
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  const q = typeof params.q === "string" ? params.q.trim() : "";

  // Receipt number, reference, or the member's name or member number.
  const where: Prisma.PaymentWhereInput = q
    ? {
        OR: [
          { receiptNumber: { contains: q, mode: "insensitive" } },
          { reference: { contains: q, mode: "insensitive" } },
          { member: { surname: { contains: q, mode: "insensitive" } } },
          { member: { firstName: { contains: q, mode: "insensitive" } } },
          { member: { memberNumber: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(targetPage));
    return `/admin/payments?${next.toString()}`;
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { member: true, plan: true, fund: true },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.payment.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: DataTableColumn<PaymentRow>[] = [
    {
      key: "receipt",
      header: "Receipt",
      cell: (payment) => (
        <Link href={`/admin/payments/${payment.id}`} className="font-mono font-medium hover:underline">
          {payment.receiptNumber}
        </Link>
      ),
    },
    { key: "member", header: "Member", cell: (payment) => `${payment.member.surname} ${payment.member.firstName}` },
    { key: "for", header: "For", cell: (payment) => payment.plan?.name ?? payment.fund?.name ?? "General" },
    { key: "amount", header: "Amount", align: "right", cell: (payment) => <Money kobo={payment.amountKobo} /> },
    { key: "method", header: "Method", cell: (payment) => payment.method },
    { key: "date", header: "Date", cell: (payment) => formatLagosDate(payment.paidAt) },
    {
      key: "status",
      header: "Status",
      cell: (payment) => (
        <StatusTag tone={payment.status === "VOIDED" ? "alert" : "confirmed"}>
          {payment.status === "VOIDED" ? "Voided" : "Confirmed"}
        </StatusTag>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Payments"
        description={q ? `${total} payment${total === 1 ? "" : "s"} match this search` : `${total} payment${total === 1 ? "" : "s"} recorded`}
        actions={<Button render={<Link href="/admin/payments/new">Record a payment</Link>} />}
      />

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <FormField label="Search" htmlFor="q">
              <Input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Receipt, reference, name or member number"
                className="w-80"
              />
            </FormField>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={payments}
        rowKey={(payment) => payment.id}
        emptyMessage={
          <>
            No payments recorded yet.{" "}
            <Link href="/admin/payments/new" className="underline underline-offset-2">
              Record one
            </Link>{" "}
            to get started.
          </>
        }
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
