import type { Payment, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";

/**
 * A payment is never edited or deleted (CLAUDE.md domain rule 2). This
 * only ever sets status to VOIDED alongside who, when and why, reverses
 * the amount against the contribution record it was applied to (if any:
 * a fund donation has none), and writes the audit entry, all in the
 * caller's transaction. The original row is otherwise untouched.
 */
export async function applyVoid(
  tx: Prisma.TransactionClient,
  payment: Payment,
  reason: string,
  actorId: string,
): Promise<Payment> {
  const voided = await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: "VOIDED",
      voidedById: actorId,
      voidedAt: new Date(),
      voidReason: reason,
    },
  });

  if (payment.contributionRecordId) {
    await tx.contributionRecord.update({
      where: { id: payment.contributionRecordId },
      data: { amountPaidKobo: { decrement: payment.amountKobo } },
    });
  }

  await writeAudit(
    {
      actorId,
      action: "payment.voided",
      entity: "Payment",
      entityId: payment.id,
      before: payment,
      after: voided,
    },
    tx,
  );

  return voided;
}
