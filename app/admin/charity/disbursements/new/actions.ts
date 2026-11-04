"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { MoneyError, parseNairaText } from "@/lib/money";
import { checkDisbursement, recordDisbursement } from "@/lib/charity/record-disbursement";
import { deleteFile, uploadFile } from "@/lib/storage";
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

  let amountKobo: number;
  try {
    amountKobo = parseNairaText(parsed.data.amount);
  } catch (error) {
    return { error: error instanceof MoneyError ? error.message : "Invalid amount." };
  }

  // Run every check that does not need the row locks first, so an
  // obvious refusal never uploads a file that nothing will point to.
  const precheck = await checkDisbursement(prisma, {
    fundId: parsed.data.fundId,
    caseId: parsed.data.caseId,
    amountKobo,
  });
  if ("error" in precheck) {
    return { error: precheck.error };
  }

  let evidencePath: string | null = null;
  const evidenceFile = formData.get("evidence");
  if (evidenceFile instanceof File && evidenceFile.size > 0) {
    evidencePath = await uploadFile(evidenceFile, "disbursement-evidence");
  }

  let result: Awaited<ReturnType<typeof recordDisbursement>>;
  try {
    result = await prisma.$transaction((tx) =>
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
  } catch (error) {
    await removeOrphanEvidence(evidencePath);
    throw error;
  }

  if ("error" in result) {
    await removeOrphanEvidence(evidencePath);
    return { error: result.error };
  }

  redirect(`/admin/charity/cases/${parsed.data.caseId}`);
}

/**
 * Deletes an evidence file whose disbursement was refused, so nothing is
 * left in storage that no record points to. A failure to delete is
 * logged rather than shown: the person still needs to see why the
 * disbursement itself was refused.
 */
async function removeOrphanEvidence(path: string | null): Promise<void> {
  if (!path) return;
  try {
    await deleteFile(path);
  } catch (error) {
    console.error("Could not remove unused disbursement evidence", path, error);
  }
}
