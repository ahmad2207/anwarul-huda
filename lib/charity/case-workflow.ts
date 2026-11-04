import type { CaseStatus, CharityCase, Prisma, ZakatCategory } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { generateCaseReference } from "@/lib/case-reference";

export type WorkflowResult = { error: string } | { case: CharityCase };

export const CASE_CHANGED_ERROR = "This case has changed since you opened it. Reload and try again.";

export interface CreateCaseInput {
  beneficiaryName: string;
  beneficiaryPhone: string | null;
  beneficiaryAddress: string | null;
  isMember: boolean;
  linkedMemberId: string | null;
  needDescription: string;
  zakatCategory: ZakatCategory | null;
  requestedKobo: number;
  actorId: string;
}

/** A new case always starts as a DRAFT: nobody has verified the need yet. */
export async function createCase(tx: Prisma.TransactionClient, input: CreateCaseInput): Promise<CharityCase> {
  const reference = await generateCaseReference(tx);

  const created = await tx.charityCase.create({
    data: {
      reference,
      beneficiaryName: input.beneficiaryName,
      beneficiaryPhone: input.beneficiaryPhone,
      beneficiaryAddress: input.beneficiaryAddress,
      isMember: input.isMember,
      linkedMemberId: input.linkedMemberId,
      needDescription: input.needDescription,
      zakatCategory: input.zakatCategory,
      requestedKobo: input.requestedKobo,
      status: "DRAFT",
    },
  });

  await writeAudit(
    {
      actorId: input.actorId,
      action: "charity_case.created",
      entity: "CharityCase",
      entityId: created.id,
      before: null,
      after: created,
    },
    tx,
  );

  return created;
}

/**
 * Locks the case row and reads it fresh inside the transaction. Every
 * rule below is checked against this fresh row, never against the copy
 * the caller loaded earlier, which may already be out of date. If the
 * caller's copy no longer matches the row's status, someone else has
 * moved the case on in the meantime and the caller must reload.
 */
async function lockFreshCase(
  tx: Prisma.TransactionClient,
  snapshot: CharityCase,
): Promise<{ error: string } | { fresh: CharityCase }> {
  await tx.$queryRaw`SELECT id FROM charity_cases WHERE id = ${snapshot.id} FOR UPDATE`;
  const fresh = await tx.charityCase.findUnique({ where: { id: snapshot.id } });
  if (!fresh) return { error: "This case no longer exists." };
  if (fresh.status !== snapshot.status) return { error: CASE_CHANGED_ERROR };
  return { fresh };
}

/**
 * Moves a case from one status to the next only if it is still in the
 * expected status. A conditional update, so even without the row lock
 * two people acting at once can never both succeed.
 */
async function transition(
  tx: Prisma.TransactionClient,
  fresh: CharityCase,
  expected: CaseStatus[],
  data: Prisma.CharityCaseUncheckedUpdateManyInput,
  extraWhere: Prisma.CharityCaseWhereInput = {},
): Promise<{ error: string } | { updated: CharityCase }> {
  const result = await tx.charityCase.updateMany({
    where: { id: fresh.id, status: { in: expected }, ...extraWhere },
    data,
  });
  if (result.count !== 1) return { error: CASE_CHANGED_ERROR };
  const updated = await tx.charityCase.findUniqueOrThrow({ where: { id: fresh.id } });
  return { updated };
}

export async function verifyCase(
  tx: Prisma.TransactionClient,
  charityCase: CharityCase,
  actorId: string,
): Promise<WorkflowResult> {
  if (charityCase.status !== "DRAFT") {
    return { error: "Only a draft case can be verified." };
  }
  const locked = await lockFreshCase(tx, charityCase);
  if ("error" in locked) return locked;
  const { fresh } = locked;

  const moved = await transition(tx, fresh, ["DRAFT"], {
    status: "VERIFIED",
    verifiedById: actorId,
    verifiedAt: new Date(),
  });
  if ("error" in moved) return moved;

  await writeAudit(
    {
      actorId,
      action: "charity_case.verified",
      entity: "CharityCase",
      entityId: fresh.id,
      before: fresh,
      after: moved.updated,
    },
    tx,
  );

  return { case: moved.updated };
}

export async function recommendCase(
  tx: Prisma.TransactionClient,
  charityCase: CharityCase,
  actorId: string,
  recommendedKobo: number,
): Promise<WorkflowResult> {
  if (charityCase.status !== "VERIFIED") {
    return { error: "Only a verified case can be recommended." };
  }
  if (recommendedKobo <= 0) {
    return { error: "Enter a recommended amount greater than zero." };
  }
  const locked = await lockFreshCase(tx, charityCase);
  if ("error" in locked) return locked;
  const { fresh } = locked;

  // Separation of duty (CLAUDE.md domain rule 4), from the other side:
  // someone who has already approved this case can never be recorded as
  // its recommender after the fact.
  if (fresh.approvedById === actorId) {
    return { error: "The person who approved this case cannot also recommend it." };
  }

  const moved = await transition(tx, fresh, ["VERIFIED"], {
    status: "RECOMMENDED",
    recommendedById: actorId,
    recommendedAt: new Date(),
    recommendedKobo,
  });
  if ("error" in moved) return moved;

  await writeAudit(
    {
      actorId,
      action: "charity_case.recommended",
      entity: "CharityCase",
      entityId: fresh.id,
      before: fresh,
      after: moved.updated,
    },
    tx,
  );

  return { case: moved.updated };
}

export async function approveCase(
  tx: Prisma.TransactionClient,
  charityCase: CharityCase,
  actorId: string,
  approvedKobo: number,
  decisionNote: string | null,
): Promise<WorkflowResult> {
  if (charityCase.status !== "RECOMMENDED") {
    return { error: "Only a recommended case can be approved." };
  }
  if (approvedKobo <= 0) {
    return { error: "Enter an approved amount greater than zero." };
  }
  const locked = await lockFreshCase(tx, charityCase);
  if ("error" in locked) return locked;
  const { fresh } = locked;

  // Separation of duty (CLAUDE.md domain rule 4): the person who
  // recommended a case can never also be the one who approves it, even
  // though a super admin's role would technically pass either step's
  // role check on its own. Checked here, against the actual person on
  // the fresh row, not the role and not the caller's earlier copy.
  if (!fresh.recommendedById || fresh.recommendedById === actorId) {
    return { error: "The person who recommended this case cannot also approve it." };
  }

  const moved = await transition(
    tx,
    fresh,
    ["RECOMMENDED"],
    { status: "APPROVED", approvedById: actorId, approvedAt: new Date(), approvedKobo, decisionNote },
    { recommendedById: { not: actorId } },
  );
  if ("error" in moved) return moved;

  await writeAudit(
    {
      actorId,
      action: "charity_case.approved",
      entity: "CharityCase",
      entityId: fresh.id,
      before: fresh,
      after: moved.updated,
    },
    tx,
  );

  return { case: moved.updated };
}

const REJECTABLE: CaseStatus[] = ["DRAFT", "VERIFIED", "RECOMMENDED"];

export async function rejectCase(
  tx: Prisma.TransactionClient,
  charityCase: CharityCase,
  actorId: string,
  reason: string,
): Promise<WorkflowResult> {
  if (!REJECTABLE.includes(charityCase.status)) {
    return { error: "This case has already been decided and cannot be rejected." };
  }
  const locked = await lockFreshCase(tx, charityCase);
  if ("error" in locked) return locked;
  const { fresh } = locked;

  // The conditional update only matches an undecided case, so a case
  // that has been approved or paid out can never be rejected, however
  // the two requests interleave.
  const moved = await transition(tx, fresh, REJECTABLE, { status: "REJECTED", decisionNote: reason });
  if ("error" in moved) return moved;

  await writeAudit(
    {
      actorId,
      action: "charity_case.rejected",
      entity: "CharityCase",
      entityId: fresh.id,
      before: fresh,
      after: moved.updated,
    },
    tx,
  );

  return { case: moved.updated };
}

export async function closeCase(
  tx: Prisma.TransactionClient,
  charityCase: CharityCase,
  actorId: string,
): Promise<WorkflowResult> {
  if (charityCase.status !== "DISBURSED") {
    return { error: "Only a disbursed case can be closed." };
  }
  const locked = await lockFreshCase(tx, charityCase);
  if ("error" in locked) return locked;
  const { fresh } = locked;

  const moved = await transition(tx, fresh, ["DISBURSED"], { status: "CLOSED" });
  if ("error" in moved) return moved;

  await writeAudit(
    {
      actorId,
      action: "charity_case.closed",
      entity: "CharityCase",
      entityId: fresh.id,
      before: fresh,
      after: moved.updated,
    },
    tx,
  );

  return { case: moved.updated };
}
