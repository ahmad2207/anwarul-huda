"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { CalibrationError, recordCalibrationSample } from "@/lib/face/calibration";
import { FaceThresholdError, setFaceThresholds } from "@/lib/face/threshold-settings";
import { faceEnrolmentPayloadSchema } from "@/app/account/face/schema";
import type { SaveFaceEnrolmentResult } from "@/app/account/face/actions";

const thresholdSchema = z.object({
  matchThreshold: z.coerce.number({ message: "Enter the threshold as a number, such as 0.55." }),
  minMargin: z.coerce.number({ message: "Enter the margin as a number, such as 0.05." }),
  note: z.string().trim().min(1, "Say why, such as which calibration results this is based on.").max(1000),
});

export interface ThresholdActionState {
  error?: string;
  saved?: boolean;
}

export async function setFaceThresholdsAction(
  _previous: ThresholdActionState,
  formData: FormData,
): Promise<ThresholdActionState> {
  const actor = await requireRole(["SUPER_ADMIN"]);
  const parsed = thresholdSchema.safeParse({
    matchThreshold: formData.get("matchThreshold"),
    minMargin: formData.get("minMargin"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values and try again." };
  }
  try {
    await setFaceThresholds(actor, parsed.data);
  } catch (error) {
    if (error instanceof FaceThresholdError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/devices/face-calibration");
  return { saved: true };
}

/**
 * Scores one calibration capture and keeps only the scores
 * (lib/face/calibration.ts). Shaped like the enrolment save so the same
 * capture screen, with its liveness check, can be reused unchanged.
 */
export async function saveCalibrationSample(
  gatheringId: string,
  memberId: string,
  input: { embedding: number[]; livenessScore: number; deviceLabel?: string },
): Promise<SaveFaceEnrolmentResult> {
  const actor = await requireRole(["SUPER_ADMIN"]);
  const parsed = faceEnrolmentPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That capture could not be read. Try again." };
  }
  try {
    await recordCalibrationSample(actor, {
      gatheringId,
      memberId,
      embedding: parsed.data.embedding,
      livenessScore: parsed.data.livenessScore,
    });
  } catch (error) {
    if (error instanceof CalibrationError) return { ok: false, final: true, error: error.message };
    throw error;
  }
  revalidatePath("/admin/devices/face-calibration");
  return { ok: true };
}
