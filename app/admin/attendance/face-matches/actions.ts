"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { FaceMatchReviewError, resolveFaceMatchCase, runRetrospectiveScan } from "@/lib/face/match-cases";
import { resolveFaceMatchSchema } from "./schema";

export interface FaceMatchActionState {
  error?: string;
  message?: string;
}

// Role is checked here, and wing scope per case inside
// resolveFaceMatchCase, so an attendance officer cannot decide a pair
// that reaches outside their wings by posting its id directly.
export async function resolveFaceMatchAction(
  _previous: FaceMatchActionState,
  formData: FormData,
): Promise<FaceMatchActionState> {
  const reviewer = await requireRole(["ATTENDANCE_OFFICER"]);
  const parsed = resolveFaceMatchSchema.safeParse({
    caseId: formData.get("caseId"),
    outcome: formData.get("outcome"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the decision and try again." };
  }

  try {
    await resolveFaceMatchCase(reviewer, parsed.data.caseId, parsed.data.outcome, parsed.data.note);
  } catch (error) {
    if (error instanceof FaceMatchReviewError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/attendance/face-matches");
  return { message: "Decision recorded." };
}

export async function runRetrospectiveScanAction(): Promise<FaceMatchActionState> {
  const reviewer = await requireRole(["SUPER_ADMIN"]);
  try {
    const { pairsFound, casesOpened } = await runRetrospectiveScan(reviewer);
    revalidatePath("/admin/attendance/face-matches");
    if (pairsFound === 0) return { message: "Scan finished. No enrolled faces are close enough to confuse check-in." };
    return {
      message: `Scan finished. ${pairsFound} close ${pairsFound === 1 ? "pair" : "pairs"} found, ${casesOpened} new ${
        casesOpened === 1 ? "case" : "cases"
      } opened. Pairs that already had a case were left as they were.`,
    };
  } catch (error) {
    if (error instanceof FaceMatchReviewError) return { error: error.message };
    throw error;
  }
}
