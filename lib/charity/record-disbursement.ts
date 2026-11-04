import type { CharityCase, Disbursement, PaymentMethod, Prisma, PrismaClient } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { generateDisbursementReference } from "@/lib/disbursement-reference";
import { formatNaira } from "@/lib/money";
import { getFundBalance } from "./fund-balance";

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

export type DisbursementCheck = { error: string } | { charityCase: CharityCase };

/**
 * Every rule a disbursement must pass, without writing anything. Called
 * twice: once by the server action before an evidence file is uploaded,
 * so an obvious refusal never leaves an orphan file behind, and again by
 * recordDisbursement inside the transaction, after the case and fund
 * rows are locked, which is the check that actually counts.
 */
export async function checkDisbursement(
  db: PrismaClient | Prisma.TransactionClient,
  input: Pick<RecordDisbursementInput, "fundId" | "caseId" | "amountKobo">,
): Promise<DisbursementCheck> {
  if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  const fund = await db.fund.findUnique({ where: { id: input.fundId } });
  if (!fund || !fund.isActive) {
    return { error: "Choose a valid, active fund." };
  }

  const charityCase = await db.charityCase.findUnique({ where: { id: input.caseId } });
  if (!charityCase) {
    return { error: "This case no longer exists." };
  }
  if (charityCase.status !== "APPROVED" && charityCase.status !== "DISBURSED") {
    return { error: "Only an approved case can receive a disbursement." };
  }

  if (fund.type === "ZAKAT" && !charityCase.zakatCategory) {
    return { error: "Assign a zakat category to this case before disbursing from a zakat fund." };
  }

  // A case can never be paid more in total than was approved for it.
  if (charityCase.approvedKobo === null) {
    return { error: "This case has no approved amount, so nothing can be paid against it." };
  }
  const alreadyPaid = await db.disbursement.aggregate({
    where: { caseId: charityCase.id },
    _sum: { amountKobo: true },
  });
  const remainingForCase = charityCase.approvedKobo - (alreadyPaid._sum.amountKobo ?? 0);
  if (input.amountKobo > remainingForCase) {
    return {
      error:
        remainingForCase > 0
          ? `This case can only receive ${formatNaira(remainingForCase)} more. The approved amount is ${formatNaira(charityCase.approvedKobo)}.`
          : `This case has already received its full approved amount of ${formatNaira(charityCase.approvedKobo)}.`,
    };
  }

  // A fund can never be paid out below zero.
  const balance = await getFundBalance(fund.id, {}, db);
  if (input.amountKobo > balance.closingBalanceKobo) {
    return {
      error: `There is not enough money in this fund. Available: ${formatNaira(Math.max(balance.closingBalanceKobo, 0))}.`,
    };
  }

  return { charityCase };
}

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
 *
 * It also refuses to pay a case more than its approved amount in total,
 * and refuses to take a fund below zero.
 */
export async function recordDisbursement(
  tx: Prisma.TransactionClient,
  input: RecordDisbursementInput,
): Promise<DisbursementResult> {
  // Lock the case, then the fund, before checking anything, so two
  // disbursements recorded at the same moment cannot both pass the
  // approved amount and fund balance checks. Always case first, then
  // fund, so two transactions never wait on each other in a cycle.
  await tx.$queryRaw`SELECT id FROM charity_cases WHERE id = ${input.caseId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM funds WHERE id = ${input.fundId} FOR UPDATE`;

  const check = await checkDisbursement(tx, input);
  if ("error" in check) return check;
  const { charityCase } = check;

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
    const moved = await tx.charityCase.updateMany({
      where: { id: charityCase.id, status: "APPROVED" },
      data: { status: "DISBURSED" },
    });
    if (moved.count !== 1) {
      // Cannot happen while the row lock above is held, but refuse
      // loudly (rolling back the disbursement) rather than carry on.
      throw new Error("This case has changed since you opened it. Reload and try again.");
    }
    // Every other CharityCase status transition (verify, recommend,
    // approve, reject, close) is audited on its own in
    // lib/charity/case-workflow.ts; this one is a side effect of
    // recording a disbursement rather than its own action, but it is
    // still a state change worth its own trail entry, not just implied
    // by the Disbursement row below.
    await writeAudit(
      {
        actorId: input.actorId,
        action: "charity_case.disbursed",
        entity: "CharityCase",
        entityId: charityCase.id,
        before: { status: charityCase.status },
        after: { status: "DISBURSED" },
      },
      tx,
    );
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
