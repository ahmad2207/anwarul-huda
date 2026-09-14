import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  POS: "POS",
  BANK_TRANSFER: "Bank transfer",
};

export default async function MyContributionsPage() {
  const user = await getCurrentUser();

  if (!user.memberId) {
    return (
      <p className="text-sm text-muted-foreground">
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
      <div>
        <h1 className="text-lg font-semibold">My contributions</h1>
        <p className="text-sm text-muted-foreground">Your payment history and outstanding balance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Outstanding balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-semibold ${outstandingKobo > 0 ? "text-destructive" : ""}`}>
            {formatNaira(outstandingKobo)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Payment history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div>
                <p className="font-medium">{payment.plan?.name ?? payment.fund?.name ?? "General"}</p>
                <p className="text-xs text-muted-foreground">
                  {payment.receiptNumber} &middot; {payment.paidAt.toLocaleDateString("en-NG")} &middot;{" "}
                  {METHOD_LABELS[payment.method] ?? payment.method}
                  {payment.status === "VOIDED" ? " · Voided" : ""}
                </p>
              </div>
              <span className={payment.status === "VOIDED" ? "text-muted-foreground line-through" : ""}>
                {formatNaira(payment.amountKobo)}
              </span>
            </div>
          ))}
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
