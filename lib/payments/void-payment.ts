import type { Payment, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";

export class PaymentAlreadyVoidedError extends Error {
  constructor() {
    super("This payment has already been voided.");
    this.name = "PaymentAlreadyVoidedError";
  }
}

/**
 * A payment is never edited or deleted (CLAUDE.md domain rule 2). This
 * only ever sets status to VOIDED alongside who, when and why, reverses
 * the amount against the contribution record it was applied to (if any:
 * a fund donation has none), and writes the audit entry, all in the
 * caller's transaction. The original row is otherwise untouched.
 *
 * The status change is conditional on the payment still being confirmed,
 * and everything else follows from it inside the same transaction. Two
 * voids of the same payment at once therefore reverse the money once:
 * the second finds nothing left to void and throws
 * PaymentAlreadyVoidedError, rolling its transaction back.
 */
export async function applyVoid(
  tx: Prisma.TransactionClient,
  payment: Pick<Payment, "id">,
  reason: string,
  actorId: string,
): Promise<Payment> {
  const before = await tx.payment.findUnique({ where: { id: payment.id } });
  const changed = await tx.payment.updateMany({
    where: { id: payment.id, status: "CONFIRMED" },
    data: {
      status: "VOIDED",
      voidedById: actorId,
      voidedAt: new Date(),
      voidReason: reason,
    },
  });
  if (!before || changed.count === 0) {
    throw new PaymentAlreadyVoidedError();
  }
  const voided = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });

  if (before.contributionRecordId) {
    await tx.contributionRecord.update({
      where: { id: before.contributionRecordId },
      data: { amountPaidKobo: { decrement: before.amountKobo } },
    });
  }

  await writeAudit(
    {
      actorId,
      action: "payment.voided",
      entity: "Payment",
      entityId: payment.id,
      before,
      after: voided,
    },
    tx,
  );

  return voided;
}
