import type { Frequency, Payment, PaymentMethod, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { generateReceiptNumber } from "@/lib/receipt-number";
import { computePeriod } from "@/lib/contributions/period";

export interface RecordPaymentInput {
  memberId: string;
  amountKobo: number;
  method: PaymentMethod;
  reference: string | null;
  narration: string | null;
  actorId: string;
  cashSessionId: string | null;
  /** Set when this payment is against a contribution plan. */
  plan: { id: string; frequency: Frequency; amountKobo: number } | null;
  /**
   * The period this plan payment settles, chosen by the officer (see
   * lib/payments/payable-periods.ts). Null or absent means the current
   * period. Any other period must already have a contribution record for
   * this member, which is what arrears are.
   */
  periodLabel?: string | null;
  /** Set when this payment is a donation to a fund. */
  fundId: string | null;
}

export class RecordPaymentError extends Error {}

/**
 * Records one payment: generates its receipt number, applies it to the
 * contribution record for the chosen period if it is against a plan
 * (an earlier period in arrears, or the current period, creating the
 * current record on demand if nobody has run the period generation step
 * yet, using the same idempotent key so it is never duplicated), and
 * writes the audit entry. All inside the caller's
 * transaction, so the receipt number, the payment row, the contribution
 * record update and the audit entry commit or fail together.
 */
export async function recordPayment(tx: Prisma.TransactionClient, input: RecordPaymentInput): Promise<Payment> {
  let contributionRecordId: string | null = null;

  if (input.plan) {
    const period = computePeriod(input.plan.frequency);
    const record =
      input.periodLabel && input.periodLabel !== period.periodLabel
        ? await tx.contributionRecord.findUnique({
            where: {
              memberId_planId_periodLabel: {
                memberId: input.memberId,
                planId: input.plan.id,
                periodLabel: input.periodLabel,
              },
            },
          })
        : await tx.contributionRecord.upsert({
            where: {
              memberId_planId_periodLabel: {
                memberId: input.memberId,
                planId: input.plan.id,
                periodLabel: period.periodLabel,
              },
            },
            update: {},
            create: {
              memberId: input.memberId,
              planId: input.plan.id,
              periodLabel: period.periodLabel,
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
              amountDueKobo: input.plan.amountKobo,
            },
          });
    if (!record) {
      throw new RecordPaymentError("Nothing is due from this member for that period. Choose another period.");
    }
    contributionRecordId = record.id;

    await tx.contributionRecord.update({
      where: { id: record.id },
      data: { amountPaidKobo: { increment: input.amountKobo } },
    });
  }

  const receiptNumber = await generateReceiptNumber(tx);

  const created = await tx.payment.create({
    data: {
      receiptNumber,
      memberId: input.memberId,
      planId: input.plan?.id ?? null,
      contributionRecordId,
      fundId: input.fundId,
      amountKobo: input.amountKobo,
      method: input.method,
      reference: input.reference,
      narration: input.narration,
      paidAt: new Date(),
      collectedById: input.actorId,
      cashSessionId: input.cashSessionId,
    },
  });

  await writeAudit(
    {
      actorId: input.actorId,
      action: "payment.recorded",
      entity: "Payment",
      entityId: created.id,
      before: null,
      after: created,
    },
    tx,
  );

  return created;
}
