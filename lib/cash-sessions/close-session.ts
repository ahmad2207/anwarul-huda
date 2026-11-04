import type { CashSession, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";

export type CloseSessionResult =
  | { error: string }
  | { session: CashSession };

/**
 * Closes a cash session: computes expected cash (the opening float plus
 * every confirmed cash payment attached to this session), compares it to
 * what was actually counted, and records the variance. A non-zero
 * variance is refused without a note explaining it, this is the control
 * that makes cash handling defensible to the committee (docs/SPEC.md
 * 2.4). A session already closed cannot be closed again.
 */
export async function closeSession(
  tx: Prisma.TransactionClient,
  session: CashSession,
  countedCashKobo: number,
  varianceNote: string | null,
  actorId: string,
): Promise<CloseSessionResult> {
  // Locks the session row for the rest of this transaction, the same lock
  // a cash payment takes before attaching to it (app/admin/payments/new/
  // actions.ts), then reads the status again under that lock. A payment
  // in flight either commits before the total below is taken, or waits
  // and then finds the session closed. A second close at the same moment
  // finds it closed too, instead of overwriting the first close's count.
  await tx.$queryRaw`SELECT id FROM cash_sessions WHERE id = ${session.id} FOR UPDATE`;
  const current = await tx.cashSession.findUnique({ where: { id: session.id } });
  if (!current || current.status === "CLOSED") {
    return { error: "This cash session is already closed and cannot be reopened." };
  }

  const cashTotal = await tx.payment.aggregate({
    where: { cashSessionId: session.id, method: "CASH", status: "CONFIRMED" },
    _sum: { amountKobo: true },
  });
  const expectedCashKobo = current.openingFloatKobo + (cashTotal._sum.amountKobo ?? 0);
  const varianceKobo = countedCashKobo - expectedCashKobo;

  if (varianceKobo !== 0 && !varianceNote) {
    return {
      error:
        "The counted amount does not match what was expected. Enter a note explaining the difference.",
    };
  }

  const updated = await tx.cashSession.update({
    where: { id: session.id },
    data: {
      status: "CLOSED",
      closedById: actorId,
      closedAt: new Date(),
      countedCashKobo,
      expectedCashKobo,
      varianceKobo,
      varianceNote,
    },
  });

  await writeAudit(
    {
      actorId,
      action: "cash_session.closed",
      entity: "CashSession",
      entityId: session.id,
      before: current,
      after: updated,
    },
    tx,
  );

  return { session: updated };
}
