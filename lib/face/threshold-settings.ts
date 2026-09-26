import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { UNCALIBRATED_MATCH_THRESHOLD, UNCALIBRATED_MIN_MATCH_MARGIN } from "@/lib/face/thresholds";

// The check-in threshold and minimum margin in force (SPEC-ADDENDUM-
// ACCOUNTS-AND-FACE.md B3 #2): the latest configured setting, or the
// uncalibrated defaults until a super admin sets one from calibration
// data. Read wherever a face is matched, so a change takes effect on the
// next check-in, the next enrolment's duplicate check and the next scan,
// with no redeploy.

export interface FaceThresholds {
  matchThreshold: number;
  minMargin: number;
  /** "default" until anyone has configured a value from calibration data. */
  source: "configured" | "default";
  changedAt: Date | null;
  changedBy: { email: string | null; phone: string | null } | null;
  note: string | null;
}

export const DEFAULT_FACE_THRESHOLDS: FaceThresholds = {
  matchThreshold: UNCALIBRATED_MATCH_THRESHOLD,
  minMargin: UNCALIBRATED_MIN_MATCH_MARGIN,
  source: "default",
  changedAt: null,
  changedBy: null,
  note: null,
};

export async function getFaceThresholds(): Promise<FaceThresholds> {
  const latest = await prisma.faceThresholdSetting.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      matchThreshold: true,
      minMargin: true,
      note: true,
      createdAt: true,
      changedBy: { select: { email: true, phone: true } },
    },
  });
  if (!latest) return DEFAULT_FACE_THRESHOLDS;
  return {
    matchThreshold: latest.matchThreshold,
    minMargin: latest.minMargin,
    source: "configured",
    changedAt: latest.createdAt,
    changedBy: latest.changedBy,
    note: latest.note,
  };
}

export class FaceThresholdError extends Error {}

/**
 * Bounds that keep a mistyped value from switching face check-in off or
 * letting anyone through: a threshold must sit strictly between 0 and 1,
 * and a margin between 0 and 0.5. Within those, the value is the super
 * admin's call from the calibration data.
 */
export function validateFaceThresholds(matchThreshold: number, minMargin: number): string | null {
  if (!Number.isFinite(matchThreshold) || matchThreshold <= 0 || matchThreshold >= 1) {
    return "The threshold must be between 0 and 1.";
  }
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 0.5) {
    return "The margin must be between 0 and 0.5.";
  }
  return null;
}

/** Records a new setting, never overwriting the old one, and audits it with who, when and why. */
export async function setFaceThresholds(
  actor: { id: string; roles: string[] },
  input: { matchThreshold: number; minMargin: number; note: string },
): Promise<void> {
  if (!actor.roles.includes("SUPER_ADMIN")) {
    throw new FaceThresholdError("Only a super administrator can change the face check-in threshold.");
  }
  const invalid = validateFaceThresholds(input.matchThreshold, input.minMargin);
  if (invalid) throw new FaceThresholdError(invalid);
  const note = input.note.trim();
  if (!note) throw new FaceThresholdError("Say why, such as which calibration results this is based on.");

  const before = await getFaceThresholds();
  await prisma.$transaction(async (tx) => {
    const created = await tx.faceThresholdSetting.create({
      data: { matchThreshold: input.matchThreshold, minMargin: input.minMargin, note, changedById: actor.id },
    });
    await writeAudit(
      {
        actorId: actor.id,
        action: "face_threshold.changed",
        entity: "FaceThresholdSetting",
        entityId: created.id,
        before: { matchThreshold: before.matchThreshold, minMargin: before.minMargin, source: before.source },
        after: { matchThreshold: input.matchThreshold, minMargin: input.minMargin, note },
      },
      tx,
    );
  });
}
