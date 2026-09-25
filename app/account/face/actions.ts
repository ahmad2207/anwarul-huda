"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { ageInYears } from "@/lib/members/age";
import { saveEnrolmentForMember } from "@/lib/face/save-enrolment";
import { faceEnrolmentPayloadSchema } from "./schema";

const MINIMUM_ENROLMENT_AGE = 18;

export interface SaveFaceEnrolmentInput {
  embedding: number[];
  livenessScore: number;
  deviceLabel?: string;
}

// final: trying again from this screen cannot help, so no "Try again" is offered.
export type SaveFaceEnrolmentResult = { ok: true } | { ok: false; error: string; final?: boolean };

/**
 * The one place an embedding is ever written. Called directly from
 * app/account/face/face-capture.tsx once capture succeeds, not bound to
 * a form: there is nothing here a browser form could usefully submit.
 *
 * Re-checks consent and age itself rather than trusting that the
 * capture screen already refused to run without them: that screen's
 * gate is for a member's own benefit (so they are never shown a camera
 * they should not see), this is the actual enforcement, the same
 * distinction CLAUDE.md's server validation rule draws for every
 * other input in this application.
 */
export async function saveFaceEnrolment(input: SaveFaceEnrolmentInput): Promise<SaveFaceEnrolmentResult> {
  const parsed = faceEnrolmentPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That could not be saved. Try capturing again." };
  }

  const user = await getCurrentUser();
  if (!user.memberId) {
    return { ok: false, error: "This account is not linked to a member record." };
  }

  const member = await prisma.member.findUnique({ where: { id: user.memberId } });
  if (!member) {
    return { ok: false, error: "This account is not linked to a member record." };
  }
  if (!member.consentBiometric) {
    return { ok: false, error: "Consent is needed first. Go back to your record and section 9." };
  }
  if (!member.dateOfBirth || ageInYears(member.dateOfBirth) < MINIMUM_ENROLMENT_AGE) {
    return { ok: false, error: "Face check-in is not available under the age of 18." };
  }

  const result = await saveEnrolmentForMember({
    memberId: member.id,
    embedding: parsed.data.embedding,
    livenessScore: parsed.data.livenessScore,
    deviceLabel: parsed.data.deviceLabel ?? null,
    actorId: user.id,
    officerAssisted: false,
  });

  revalidatePath("/account/face");
  if (result.kind === "saved") {
    return { ok: true };
  }
  if (result.kind === "excluded") {
    return { ok: false, final: true, error: "Face check-in is not used for your account. You are checked in by name at every gathering." };
  }
  // Never who the face resembled (MEMBER-HOME-AND-ADMIN-VIEW.md 3.2):
  // telling a member that is a breach of the other person's privacy, and
  // in the fraud case, a hint on how to try again.
  return { ok: false, final: true, error: "Setup could not be completed here. The office will help you with it at the mosque." };
}

/**
 * Withdrawal (SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md 4.2 and B1 #6): one
 * action, no reason, no administrator, hard delete. The client shows
 * its own single are-you-sure before this is ever called; there is
 * nothing further to confirm here.
 */
export async function withdrawFaceEnrolment(): Promise<void> {
  const user = await getCurrentUser();
  if (!user.memberId) {
    throw new Error("This account is not linked to a member record.");
  }
  const memberId = user.memberId;

  await prisma.$transaction(async (tx) => {
    const count = await tx.faceEnrolment.count({ where: { memberId } });
    if (count === 0) {
      return;
    }
    await tx.faceEnrolment.deleteMany({ where: { memberId } });
    await writeAudit(
      {
        actorId: user.id,
        action: "member.face_enrolment_withdrawn",
        entity: "Member",
        entityId: memberId,
        before: { hadFaceEnrolment: true },
        after: { hadFaceEnrolment: false },
      },
      tx,
    );
  });

  revalidatePath("/account/face");
}
