import type { Fund, FundType, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";

export interface UpdateFundInput {
  name: string;
  type: FundType;
  description: string | null;
  isActive: boolean;
}

export type UpdateFundResult = { error: string } | { fund: Fund };

export const FUND_TYPE_LOCKED_ERROR =
  "The type of this fund cannot be changed because money has already been received into it or paid out of it. Create a new fund instead.";

/**
 * Updates a fund's details. The zakat ring-fence (CLAUDE.md domain rule
 * 3) depends on a fund's type, so once money has gone in or out the
 * type is fixed: otherwise a zakat fund could be relabelled GENERAL,
 * spent on running costs, and relabelled back. Must be called inside a
 * transaction so the check, the update and the audit entry commit
 * together.
 */
export async function updateFundRecord(
  tx: Prisma.TransactionClient,
  fundId: string,
  input: UpdateFundInput,
  actorId: string,
): Promise<UpdateFundResult> {
  // Lock the fund row so a payment or disbursement cannot be recorded
  // against it between the activity check and the type change below.
  // recordDisbursement takes the same lock, and a new payment's foreign
  // key check waits on it too.
  await tx.$queryRaw`SELECT id FROM funds WHERE id = ${fundId} FOR UPDATE`;
  const before = await tx.fund.findUnique({ where: { id: fundId } });
  if (!before) {
    return { error: "This fund no longer exists." };
  }

  if (input.type !== before.type) {
    const paymentCount = await tx.payment.count({ where: { fundId } });
    const disbursementCount = await tx.disbursement.count({ where: { fundId } });
    if (paymentCount > 0 || disbursementCount > 0) {
      return { error: FUND_TYPE_LOCKED_ERROR };
    }
  }

  const updated = await tx.fund.update({
    where: { id: fundId },
    data: {
      name: input.name,
      type: input.type,
      description: input.description,
      isActive: input.isActive,
    },
  });

  await writeAudit(
    {
      actorId,
      action: "fund.updated",
      entity: "Fund",
      entityId: fundId,
      before,
      after: updated,
    },
    tx,
  );

  return { fund: updated };
}
