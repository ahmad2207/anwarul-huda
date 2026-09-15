"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { MoneyError, nairaToKobo } from "@/lib/money";
import {
  approveCase,
  closeCase,
  createCase,
  recommendCase,
  rejectCase,
  verifyCase,
} from "@/lib/charity/case-workflow";
import {
  approveSchema,
  createCaseFormDataToRaw,
  createCaseSchema,
  recommendSchema,
  rejectSchema,
} from "./schema";

export interface ActionState {
  error?: string;
}

function toKobo(value: string): { kobo: number } | { error: string } {
  const naira = Number(value);
  if (!Number.isFinite(naira) || naira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }
  try {
    return { kobo: nairaToKobo(naira) };
  } catch (error) {
    return { error: error instanceof MoneyError ? error.message : "Invalid amount." };
  }
}

export async function createCaseAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["CHARITY_OFFICER"]);

  const parsed = createCaseSchema.safeParse(createCaseFormDataToRaw(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const amount = toKobo(parsed.data.requested);
  if ("error" in amount) return amount;

  const created = await prisma.$transaction((tx) =>
    createCase(tx, {
      beneficiaryName: parsed.data.beneficiaryName,
      beneficiaryPhone: parsed.data.beneficiaryPhone ?? null,
      beneficiaryAddress: parsed.data.beneficiaryAddress ?? null,
      isMember: parsed.data.isMember,
      linkedMemberId: parsed.data.linkedMemberId ?? null,
      needDescription: parsed.data.needDescription,
      zakatCategory: parsed.data.zakatCategory ?? null,
      requestedKobo: amount.kobo,
      actorId: actor.id,
    }),
  );

  redirect(`/admin/charity/cases/${created.id}`);
}

async function loadCase(caseId: string) {
  return prisma.charityCase.findUnique({ where: { id: caseId } });
}

export async function verifyCaseAction(caseId: string): Promise<void> {
  const actor = await requireRole(["CHARITY_OFFICER"]);
  const charityCase = await loadCase(caseId);
  if (!charityCase) throw new Error("This case no longer exists.");

  const result = await prisma.$transaction((tx) => verifyCase(tx, charityCase, actor.id));
  if ("error" in result) throw new Error(result.error);

  revalidatePath(`/admin/charity/cases/${caseId}`);
}

export async function recommendCaseAction(
  caseId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["CHARITY_OFFICER"]);
  const parsed = recommendSchema.safeParse({ recommended: formData.get("recommended") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }
  const amount = toKobo(parsed.data.recommended);
  if ("error" in amount) return amount;

  const charityCase = await loadCase(caseId);
  if (!charityCase) return { error: "This case no longer exists." };

  const result = await prisma.$transaction((tx) => recommendCase(tx, charityCase, actor.id, amount.kobo));
  if ("error" in result) return { error: result.error };

  revalidatePath(`/admin/charity/cases/${caseId}`);
  return {};
}

export async function approveCaseAction(
  caseId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["SUPER_ADMIN"]);
  const parsed = approveSchema.safeParse({
    approved: formData.get("approved"),
    decisionNote: formData.get("decisionNote"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }
  const amount = toKobo(parsed.data.approved);
  if ("error" in amount) return amount;

  const charityCase = await loadCase(caseId);
  if (!charityCase) return { error: "This case no longer exists." };

  const result = await prisma.$transaction((tx) =>
    approveCase(tx, charityCase, actor.id, amount.kobo, parsed.data.decisionNote ?? null),
  );
  if ("error" in result) return { error: result.error };

  revalidatePath(`/admin/charity/cases/${caseId}`);
  return {};
}

export async function rejectCaseAction(
  caseId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["CHARITY_OFFICER"]);
  const parsed = rejectSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const charityCase = await loadCase(caseId);
  if (!charityCase) return { error: "This case no longer exists." };

  const result = await prisma.$transaction((tx) => rejectCase(tx, charityCase, actor.id, parsed.data.reason));
  if ("error" in result) return { error: result.error };

  revalidatePath(`/admin/charity/cases/${caseId}`);
  return {};
}

export async function closeCaseAction(caseId: string): Promise<void> {
  const actor = await requireRole(["CHARITY_OFFICER"]);
  const charityCase = await loadCase(caseId);
  if (!charityCase) throw new Error("This case no longer exists.");

  const result = await prisma.$transaction((tx) => closeCase(tx, charityCase, actor.id));
  if ("error" in result) throw new Error(result.error);

  revalidatePath(`/admin/charity/cases/${caseId}`);
}
