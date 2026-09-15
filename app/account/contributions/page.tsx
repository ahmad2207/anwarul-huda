import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusTag } from "@/components/status-tag";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  POS: "POS",
  BANK_TRANSFER: "Bank transfer",
};

export default async function MyContributionsPage() {
  const user = await getCurrentUser();

  if (!user.memberId) {
    return (
      <p className="text-base text-muted-foreground">
        This account is not linked to a member record.
      </p>
    );
  }

  const [payments, records] = await Promise.all([
    prisma.payment.findMany({
      where: { memberId: user.memberId },
      include: { plan: true, fund: true },
      orderBy: { paidAt: "desc" },
      take: 100,
    }),
    prisma.contributionRecord.findMany({
      where: { memberId: user.memberId },
      include: { plan: true },
    }),
  ]);

  const outstandingKobo = records
    .filter((record) => record.amountPaidKobo < record.amountDueKobo)
    .reduce((sum, record) => sum + (record.amountDueKobo - record.amountPaidKobo), 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="My contributions" description="Your payment history and outstanding balance." />

      {/* DESIGN.md section 4.2: the one warm card carrying the number
          that matters most, everything else on this page stays plain.
          Outstanding is arrears, not a failure, so a balance owed still
          reads in amber (attention), never alert; paid up reads in white. */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-950 to-navy-800 p-6 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-amber-500/35 blur-3xl"
        />
        <p className="relative font-mono text-xs tracking-wide text-white/60 uppercase">Outstanding balance</p>
        <p
          className={`relative mt-2 font-mono text-4xl font-semibold ${
            outstandingKobo > 0 ? "text-amber-500" : "text-white"
          }`}
        >
          {formatNaira(outstandingKobo)}
        </p>
        <p className="relative mt-1 text-sm text-white/70">
          {outstandingKobo > 0 ? "Catch up whenever you can." : "You're paid up. Jazakumullahu khairan."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Payment history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex min-h-11 items-center justify-between rounded-md border p-3 text-base"
            >
              <div>
                <p className="font-medium">{payment.plan?.name ?? payment.fund?.name ?? "General"}</p>
                <p className="text-sm text-muted-foreground">
                  {payment.receiptNumber} &middot; {payment.paidAt.toLocaleDateString("en-NG")} &middot;{" "}
                  {METHOD_LABELS[payment.method] ?? payment.method}
                  {payment.status === "VOIDED" ? (
                    <>
                      {" "}
                      &middot; <StatusTag tone="alert">Voided</StatusTag>
                    </>
                  ) : null}
                </p>
              </div>
              <span className={payment.status === "VOIDED" ? "text-muted-foreground line-through" : ""}>
                {formatNaira(payment.amountKobo)}
              </span>
            </div>
          ))}
          {payments.length === 0 ? (
            <p className="text-base text-muted-foreground">No payments recorded yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
