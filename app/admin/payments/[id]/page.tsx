import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { formatReceiptText } from "@/lib/receipt-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReceiptActions } from "./receipt-actions";
import { VoidForm } from "./void-form";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  POS: "POS",
  BANK_TRANSFER: "Bank transfer",
};

export default async function PaymentReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["FINANCE_OFFICER"]);
  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      member: true,
      plan: true,
      fund: true,
      contributionRecord: true,
      collectedBy: true,
      voidedBy: true,
    },
  });

  if (!payment) {
    notFound();
  }

  const purpose = payment.plan
    ? `${payment.plan.name}${payment.contributionRecord ? ` (${payment.contributionRecord.periodLabel})` : ""}`
    : payment.fund
      ? `Donation to ${payment.fund.name}`
      : "General payment";

  const receiptText = formatReceiptText({
    receiptNumber: payment.receiptNumber,
    memberName: `${payment.member.surname} ${payment.member.firstName}`,
    memberNumber: payment.member.memberNumber,
    amountKobo: payment.amountKobo,
    purpose,
    methodLabel: METHOD_LABELS[payment.method] ?? payment.method,
    reference: payment.reference,
    paidAt: payment.paidAt,
    collectedByLabel: payment.collectedBy.email ?? payment.collectedBy.phone ?? "Unknown",
    status: payment.status,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-lg font-semibold">Receipt {payment.receiptNumber}</h1>
        <ReceiptActions text={receiptText} />
      </div>

      {payment.status === "VOIDED" ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          This payment was voided on {payment.voidedAt?.toLocaleString("en-NG")} by{" "}
          {payment.voidedBy?.email ?? payment.voidedBy?.phone}. Reason: {payment.voidReason}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Anwaru-l-Huda League of Nigeria</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap font-sans text-sm">{receiptText}</pre>
        </CardContent>
      </Card>

      {payment.status === "CONFIRMED" ? (
        <div className="print:hidden">
          <VoidForm paymentId={payment.id} />
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground print:hidden">
        Amount: {formatNaira(payment.amountKobo)}
      </p>
    </div>
  );
}
