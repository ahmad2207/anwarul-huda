import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { recordProgress } from "@/lib/members/record-sections";

// Permanently checking a member in by name, never by face. Reached two
// ways, with the same effect:
//
// - a face match review decides two members are different people check-in
//   cannot tell apart (MEMBER-HOME-AND-ADMIN-VIEW.md 3.5)
// - an officer records that a member will not use face check-in, for
//   whatever reason, such as a member who observes niqab or has no phone
//   (MEMBER-INTERFACE.md M5 #4 and 3.4b)
//
// Either way the member leaves the enrolment worklist for good, any saved
// face is deleted, section 9 counts as done, and nothing anywhere treats
// them as unfinished or prompts them about face again.

export type ExclusionReason =
  | { kind: "review"; faceMatchCaseId: string }
  | { kind: "declined"; note: string | null };

export async function excludeFromFaceCheckIn(
  tx: Prisma.TransactionClient,
  memberId: string,
  actorId: string,
  reason: ExclusionReason,
  at: Date = new Date(),
): Promise<void> {
  const member = await tx.member.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      completedSections: true,
      faceCheckInExcluded: true,
      faceEnrolmentDeferred: true,
      consentBiometric: true,
      isRecordIncomplete: true,
    },
  });
  const removedEnrolments = await tx.faceEnrolment.deleteMany({ where: { memberId } });

  // Completing the record this way opens the same light wing review a
  // member finishing it themselves would.
  const completedSections = member.completedSections.includes("FACE")
    ? member.completedSections
    : [...member.completedSections, "FACE" as const];
  const nowComplete = member.isRecordIncomplete && recordProgress(completedSections).isComplete;

  await tx.member.update({
    where: { id: memberId },
    data: {
      faceCheckInExcluded: true,
      faceCheckInExcludedAt: at,
      faceEnrolmentDeferred: false,
      faceEnrolmentDeferredAt: null,
      // A member who will not use face has not consented to it. After a
      // review, consent is left as the member gave it: they did agree,
      // the camera just cannot tell them apart from someone else.
      ...(reason.kind === "declined" ? { consentBiometric: false } : {}),
      completedSections,
      ...(nowComplete
        ? {
            isRecordIncomplete: false,
            needsWingReview: true,
            wingReviewReason: "Record completed",
            wingReviewRequestedAt: at,
          }
        : {}),
    },
  });

  await writeAudit(
    {
      actorId,
      action: reason.kind === "review" ? "member.face_check_in_excluded" : "member.face_check_in_declined",
      entity: "Member",
      entityId: memberId,
      before: {
        faceCheckInExcluded: member.faceCheckInExcluded,
        faceEnrolmentDeferred: member.faceEnrolmentDeferred,
        consentBiometric: member.consentBiometric,
        hadFaceEnrolment: removedEnrolments.count > 0,
      },
      after: {
        faceCheckInExcluded: true,
        faceEnrolmentDeferred: false,
        consentBiometric: reason.kind === "declined" ? false : member.consentBiometric,
        hadFaceEnrolment: false,
        ...(reason.kind === "review" ? { faceMatchCaseId: reason.faceMatchCaseId } : { note: reason.note }),
      },
    },
    tx,
  );
}
