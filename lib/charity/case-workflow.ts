import type { CharityCase, Prisma, ZakatCategory } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { generateCaseReference } from "@/lib/case-reference";

export type WorkflowResult = { error: string } | { case: CharityCase };

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

export async function verifyCase(
  tx: Prisma.TransactionClient,
  charityCase: CharityCase,
  actorId: string,
): Promise<WorkflowResult> {
  if (charityCase.status !== "DRAFT") {
    return { error: "Only a draft case can be verified." };
  }

  const updated = await tx.charityCase.update({
    where: { id: charityCase.id },
    data: { status: "VERIFIED", verifiedById: actorId, verifiedAt: new Date() },
  });

  await writeAudit(
    {
      actorId,
      action: "charity_case.verified",
      entity: "CharityCase",
      entityId: charityCase.id,
      before: charityCase,
      after: updated,
    },
    tx,
  );

  return { case: updated };
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

  const updated = await tx.charityCase.update({
    where: { id: charityCase.id },
    data: { status: "RECOMMENDED", recommendedById: actorId, recommendedAt: new Date(), recommendedKobo },
  });

  await writeAudit(
    {
      actorId,
      action: "charity_case.recommended",
      entity: "CharityCase",
      entityId: charityCase.id,
      before: charityCase,
      after: updated,
    },
    tx,
  );

  return { case: updated };
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
  // Separation of duty (CLAUDE.md domain rule 4): the person who
  // recommended a case can never also be the one who approves it, even
  // though a super admin's role would technically pass either step's
  // role check on its own. Checked here, against the actual person, not
  // the role.
  if (charityCase.recommendedById === actorId) {
    return { error: "The person who recommended this case cannot also approve it." };
  }
  if (approvedKobo <= 0) {
    return { error: "Enter an approved amount greater than zero." };
  }

  const updated = await tx.charityCase.update({
    where: { id: charityCase.id },
    data: {
      status: "APPROVED",
      approvedById: actorId,
      approvedAt: new Date(),
      approvedKobo,
      decisionNote,
    },
  });

  await writeAudit(
    {
      actorId,
      action: "charity_case.approved",
      entity: "CharityCase",
      entityId: charityCase.id,
      before: charityCase,
      after: updated,
    },
    tx,
  );

  return { case: updated };
}

export async function rejectCase(
  tx: Prisma.TransactionClient,
  charityCase: CharityCase,
  actorId: string,
  reason: string,
): Promise<WorkflowResult> {
  if (!["DRAFT", "VERIFIED", "RECOMMENDED"].includes(charityCase.status)) {
    return { error: "This case has already been decided and cannot be rejected." };
  }

  const updated = await tx.charityCase.update({
    where: { id: charityCase.id },
    data: { status: "REJECTED", decisionNote: reason },
  });

  await writeAudit(
    {
      actorId,
      action: "charity_case.rejected",
      entity: "CharityCase",
      entityId: charityCase.id,
      before: charityCase,
      after: updated,
    },
    tx,
  );

  return { case: updated };
}

export async function closeCase(
  tx: Prisma.TransactionClient,
  charityCase: CharityCase,
  actorId: string,
): Promise<WorkflowResult> {
  if (charityCase.status !== "DISBURSED") {
    return { error: "Only a disbursed case can be closed." };
  }

  const updated = await tx.charityCase.update({
    where: { id: charityCase.id },
    data: { status: "CLOSED" },
  });

  await writeAudit(
    {
      actorId,
      action: "charity_case.closed",
      entity: "CharityCase",
      entityId: charityCase.id,
      before: charityCase,
      after: updated,
    },
    tx,
  );

  return { case: updated };
}
