"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { ageInYears } from "@/lib/members/age";
import { toVectorLiteral } from "@/lib/face/vector-literal";
import { faceEnrolmentPayloadSchema } from "./schema";

const MINIMUM_ENROLMENT_AGE = 18;

export interface SaveFaceEnrolmentInput {
  embedding: number[];
  livenessScore: number;
  deviceLabel?: string;
}

export type SaveFaceEnrolmentResult = { ok: true } | { ok: false; error: string };

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

  const enrolmentId = crypto.randomUUID();
  const enrolledAt = new Date();
  const isReEnrolment = (await prisma.faceEnrolment.count({ where: { memberId: member.id } })) > 0;

  await prisma.$transaction(async (tx) => {
    // Replaces, never accumulates: every previous embedding for this
    // member is gone before the new one is written, in the same
    // transaction as the insert, so this member never has two rows,
    // and if the insert below failed, never ends up with none either.
    await tx.faceEnrolment.deleteMany({ where: { memberId: member.id } });
    await tx.$executeRaw`
      INSERT INTO face_enrolments (id, member_id, embedding, liveness_score, enrolled_at, device_label, is_active)
      VALUES (${enrolmentId}, ${member.id}, ${toVectorLiteral(parsed.data.embedding)}::vector, ${parsed.data.livenessScore}, ${enrolledAt}, ${parsed.data.deviceLabel ?? null}, true)
    `;

    // A real enrolment supersedes an earlier deferral from a previous
    // visit, and this is also how a member drops off the enrolment
    // worklist prompt M5 builds: that worklist queries deferred and
    // never enrolled members, neither of which this member now is.
    if (member.faceEnrolmentDeferred) {
      await tx.member.update({
        where: { id: member.id },
        data: { faceEnrolmentDeferred: false, faceEnrolmentDeferredAt: null },
      });
    }

    // Never the embedding itself, only that an enrolment happened, when,
    // and with what liveness score: the same boundary section 4.4 draws
    // for every admin screen applies here too, to the audit log.
    await writeAudit(
      {
        actorId: user.id,
        action: isReEnrolment ? "member.face_re_enrolled" : "member.face_enrolled",
        entity: "Member",
        entityId: member.id,
        before: null,
        after: { livenessScore: parsed.data.livenessScore, deviceLabel: parsed.data.deviceLabel ?? null },
      },
      tx,
    );
  });

  revalidatePath("/account/face");
  return { ok: true };
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
