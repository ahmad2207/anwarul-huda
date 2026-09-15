"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { MoneyError, nairaToKobo } from "@/lib/money";
import { recordDisbursement } from "@/lib/charity/record-disbursement";
import { uploadFile } from "@/lib/storage";
import { disbursementSchema } from "./schema";

export interface DisbursementActionState {
  error?: string;
}

export async function createDisbursementAction(
  _previousState: DisbursementActionState,
  formData: FormData,
): Promise<DisbursementActionState> {
  const actor = await requireRole(["CHARITY_OFFICER"]);

  const parsed = disbursementSchema.safeParse({
    fundId: formData.get("fundId"),
    caseId: formData.get("caseId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    narration: formData.get("narration"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const naira = Number(parsed.data.amount);
  if (!Number.isFinite(naira) || naira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }
  let amountKobo: number;
  try {
    amountKobo = nairaToKobo(naira);
  } catch (error) {
    return { error: error instanceof MoneyError ? error.message : "Invalid amount." };
  }

  let evidencePath: string | null = null;
  const evidenceFile = formData.get("evidence");
  if (evidenceFile instanceof File && evidenceFile.size > 0) {
    evidencePath = await uploadFile(evidenceFile, "disbursement-evidence");
  }

  const result = await prisma.$transaction((tx) =>
    recordDisbursement(tx, {
      fundId: parsed.data.fundId,
      caseId: parsed.data.caseId,
      amountKobo,
      method: parsed.data.method,
      narration: parsed.data.narration ?? null,
      evidencePath,
      actorId: actor.id,
    }),
  );

  if ("error" in result) {
    return { error: result.error };
  }

  redirect(`/admin/charity/cases/${parsed.data.caseId}`);
}
