"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { canEnrolMemberFace } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";
import { ageInYears } from "@/lib/members/age";
import { saveEnrolmentForMember } from "@/lib/face/save-enrolment";
import { faceEnrolmentPayloadSchema } from "@/app/account/face/schema";
import type { SaveFaceEnrolmentResult } from "@/app/account/face/actions";

const MINIMUM_ENROLMENT_AGE = 18;

// Officer-assisted enrolment at the mosque (MEMBER-HOME-AND-ADMIN-VIEW.md
// 3.7): the officer sees the member in person, which is the control
// against someone enrolling another person's face, and the reason this is
// the preferred path. Every check the member's own path makes is made
// again here, plus the officer's role and wing.

async function loadEnrolableMember(memberId: string) {
  const officer = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, wingId: true, consentBiometric: true, dateOfBirth: true, faceEnrolmentDeferred: true },
  });
  if (!member || !canEnrolMemberFace(officer, member.wingId)) {
    return null;
  }
  return { officer, member };
}

export interface ConsentActionState {
  error?: string;
}

/**
 * Records biometric consent given in person: the officer has read the
 * member the same words section 9 shows and the member agreed. Audited
 * with the officer as the one who recorded it, so it is never mistaken
 * for consent the member gave on their own phone.
 */
export async function recordConsentInPerson(
  memberId: string,
  _previous: ConsentActionState,
  formData: FormData,
): Promise<ConsentActionState> {
  const loaded = await loadEnrolableMember(memberId);
  if (!loaded) {
    return { error: "That member could not be found, or is not in a wing you cover." };
  }
  if (formData.get("agreed") !== "on") {
    return { error: "Tick the box once the member has heard this and agreed." };
  }

  const { officer, member } = loaded;
  await prisma.member.update({
    where: { id: member.id },
    data: { consentBiometric: true },
  });
  await writeAudit({
    actorId: officer.id,
    action: "member.face_consent_recorded_in_person",
    entity: "Member",
    entityId: member.id,
    before: { consentBiometric: member.consentBiometric },
    after: { consentBiometric: true },
  });

  revalidatePath(`/admin/members/${member.id}/face`);
  return {};
}

export async function saveFaceEnrolmentByOfficer(
  memberId: string,
  input: { embedding: number[]; livenessScore: number; deviceLabel?: string },
): Promise<SaveFaceEnrolmentResult> {
  const parsed = faceEnrolmentPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That could not be saved. Try capturing again." };
  }

  const loaded = await loadEnrolableMember(memberId);
  if (!loaded) {
    return { ok: false, final: true, error: "That member could not be found, or is not in a wing you cover." };
  }
  const { officer, member } = loaded;
  if (!member.consentBiometric) {
    return { ok: false, final: true, error: "Record the member's consent first." };
  }
  if (!member.dateOfBirth || ageInYears(member.dateOfBirth) < MINIMUM_ENROLMENT_AGE) {
    return { ok: false, final: true, error: "Face check-in is not available under the age of 18." };
  }

  const result = await saveEnrolmentForMember({
    memberId: member.id,
    embedding: parsed.data.embedding,
    livenessScore: parsed.data.livenessScore,
    deviceLabel: parsed.data.deviceLabel ?? null,
    actorId: officer.id,
    officerAssisted: true,
  });

  revalidatePath(`/admin/members/${member.id}`);
  if (result.kind === "saved") {
    return { ok: true };
  }
  if (result.kind === "excluded") {
    return { ok: false, final: true, error: "This member is checked in by name. Face check-in is not used for them." };
  }
  // Not who the face resembled, even to the officer: the review queue is
  // where that is seen, by the people allowed to see it.
  return {
    ok: false,
    final: true,
    error:
      "Setup could not be completed. This face is too close to another member's for check-in to tell them apart, so it has gone for review. Check this member in by name for now.",
  };
}
