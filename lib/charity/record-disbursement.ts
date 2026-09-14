import type { Disbursement, PaymentMethod, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { generateDisbursementReference } from "@/lib/disbursement-reference";

export interface RecordDisbursementInput {
  fundId: string;
  caseId: string;
  amountKobo: number;
  method: PaymentMethod;
  narration: string | null;
  evidencePath: string | null;
  actorId: string;
}

export type DisbursementResult = { error: string } | { disbursement: Disbursement };

/**
 * Records a disbursement against an approved case, from a specified
 * fund. This is the service layer half of the zakat ring-fence
 * (CLAUDE.md domain rule 3): a disbursement against a ZAKAT fund is
 * refused unless the case it draws from carries one of the eight zakat
 * categories. The database trigger added in the same migration as this
 * feature enforces the identical rule again at the row level (see
 * prisma/migrations for the trigger), so a bug here can never actually
 * let an uncategorised zakat disbursement through, it can only produce a
 * clearer error message before the database would refuse it anyway.
 */
export async function recordDisbursement(
  tx: Prisma.TransactionClient,
  input: RecordDisbursementInput,
): Promise<DisbursementResult> {
  const fund = await tx.fund.findUnique({ where: { id: input.fundId } });
  if (!fund || !fund.isActive) {
    return { error: "Choose a valid, active fund." };
  }

  const charityCase = await tx.charityCase.findUnique({ where: { id: input.caseId } });
  if (!charityCase) {
    return { error: "This case no longer exists." };
  }
  if (charityCase.status !== "APPROVED" && charityCase.status !== "DISBURSED") {
    return { error: "Only an approved case can receive a disbursement." };
  }

  if (fund.type === "ZAKAT" && !charityCase.zakatCategory) {
    return { error: "Assign a zakat category to this case before disbursing from a zakat fund." };
  }

  if (input.amountKobo <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  const reference = await generateDisbursementReference(tx);

  const created = await tx.disbursement.create({
    data: {
      reference,
      fundId: input.fundId,
      caseId: input.caseId,
      amountKobo: input.amountKobo,
      method: input.method,
      narration: input.narration,
      evidencePath: input.evidencePath,
      paidById: input.actorId,
      paidAt: new Date(),
    },
  });

  if (charityCase.status === "APPROVED") {
    await tx.charityCase.update({ where: { id: charityCase.id }, data: { status: "DISBURSED" } });
  }

  await writeAudit(
    {
      actorId: input.actorId,
      action: "disbursement.recorded",
      entity: "Disbursement",
      entityId: created.id,
      before: null,
      after: created,
    },
    tx,
  );

  return { disbursement: created };
}
