import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 25;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["FINANCE_OFFICER"]);
  const params = await searchParams;
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      include: { member: true, plan: true, fund: true },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.payment.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Payments</h1>
          <p className="text-sm text-muted-foreground">{total} payment{total === 1 ? "" : "s"} recorded</p>
        </div>
        <Button render={<Link href="/admin/payments/new">Record a payment</Link>} />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-2 font-medium">Receipt</th>
              <th className="p-2 font-medium">Member</th>
              <th className="p-2 font-medium">For</th>
              <th className="p-2 font-medium">Amount</th>
              <th className="p-2 font-medium">Method</th>
              <th className="p-2 font-medium">Date</th>
              <th className="p-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2">
                  <Link href={`/admin/payments/${payment.id}`} className="font-medium hover:underline">
                    {payment.receiptNumber}
                  </Link>
                </td>
                <td className="p-2">
                  {payment.member.surname} {payment.member.firstName}
                </td>
                <td className="p-2">{payment.plan?.name ?? payment.fund?.name ?? "General"}</td>
                <td className="p-2">{formatNaira(payment.amountKobo)}</td>
                <td className="p-2">{payment.method}</td>
                <td className="p-2">{payment.paidAt.toLocaleDateString("en-NG")}</td>
                <td className="p-2">{payment.status === "VOIDED" ? "Voided" : "Confirmed"}</td>
              </tr>
            ))}
            {payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  No payments recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              render={<Link href={`/admin/payments?page=${Math.max(1, page - 1)}`}>Previous</Link>}
            />
            <Button
              variant="outline"
              disabled={page >= totalPages}
              render={<Link href={`/admin/payments?page=${Math.min(totalPages, page + 1)}`}>Next</Link>}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
