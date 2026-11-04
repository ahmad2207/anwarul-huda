import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { formatLagosDate } from "@/lib/timezone";
import { StatusTag } from "@/components/status-tag";
import { BalanceCard } from "@/components/member/balance-card";
import { PageTitle, SectionHeading, memberCardClass } from "@/components/member/card";
import { Pager } from "@/components/member/pager";

const PAGE_SIZE = 20;

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  POS: "POS",
  BANK_TRANSFER: "Bank transfer",
};

export default async function MyContributionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();

  if (!user.memberId) {
    return <p className="text-base text-ink-2">This account is not linked to a member record.</p>;
  }

  const params = await searchParams;
  const requestedPage = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const [total, records] = await Promise.all([
    prisma.payment.count({ where: { memberId: user.memberId } }),
    prisma.contributionRecord.findMany({
      where: { memberId: user.memberId },
      select: { amountDueKobo: true, amountPaidKobo: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const payments = await prisma.payment.findMany({
    where: { memberId: user.memberId },
    include: { plan: { select: { name: true } }, fund: { select: { name: true } } },
    orderBy: { paidAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const outstandingKobo = records
    .filter((record) => record.amountPaidKobo < record.amountDueKobo)
    .reduce((sum, record) => sum + (record.amountDueKobo - record.amountPaidKobo), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle lead="What you owe, and every payment the office has recorded for you.">Payments</PageTitle>

      {/* DESIGN.md 4.2: the one warm card, the same one Home shows.
          Outstanding is arrears, not a failure, so a balance owed reads
          as attention, never alert. */}
      <BalanceCard
        amountKobo={outstandingKobo}
        label="Your outstanding dues"
        detail={
          outstandingKobo > 0
            ? "Dues not yet paid across your contribution plans. Catch up whenever you can."
            : "You are fully paid up. Jazakumullahu khairan."
        }
      />

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <SectionHeading id="history-heading">Payment history</SectionHeading>

        {payments.length === 0 ? (
          <p className="text-base text-ink-2">
            No payments recorded yet. When you pay the office, your receipt will appear here.
          </p>
        ) : (
          <ul className={`${memberCardClass} divide-y divide-border overflow-hidden`}>
            {payments.map((payment) => {
              const voided = payment.status === "VOIDED";
              return (
                <li key={payment.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-base font-semibold">{payment.plan?.name ?? payment.fund?.name ?? "General"}</p>
                    <p className="text-sm text-ink-2">
                      {formatLagosDate(payment.paidAt)}, {METHOD_LABELS[payment.method] ?? payment.method}
                    </p>
                    <p className="text-sm text-ink-2">
                      Receipt <span className="font-mono">{payment.receiptNumber}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`font-mono text-base font-semibold tabular-nums ${voided ? "text-ink-2 line-through" : "text-ink"}`}
                    >
                      {formatNaira(payment.amountKobo)}
                    </span>
                    {voided ? (
                      <StatusTag tone="alert">Voided</StatusTag>
                    ) : (
                      <StatusTag tone="confirmed">Paid</StatusTag>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Pager page={page} totalPages={totalPages} hrefFor={(target) => `/account/payments?page=${target}`} />
      </section>
    </div>
  );
}
