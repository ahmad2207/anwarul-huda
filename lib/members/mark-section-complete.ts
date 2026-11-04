import type { RecordSection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { recordProgress } from "@/lib/members/record-sections";

// Not a server action. It takes a member id and an actor id from its
// caller and checks neither, so it lives here, outside any "use server"
// file, where nothing in the browser can ever call it directly. Its
// callers (app/account/record/[section]/actions.ts and
// app/admin/members/incomplete/actions.ts) authorise first.
//
// Every section save adds its own RecordSection value once, never
// twice: completedSections is read first rather than pushed
// unconditionally, so revisiting and re-saving an already completed
// section does not grow the array. Completing the ninth and last
// section clears isRecordIncomplete and opens the wing administrator's
// light review (MEMBER-INTERFACE.md 3.4, M3 #9): a review, not an
// approval, so nothing about the member's status changes here.
export async function markSectionComplete(memberId: string, userId: string, section: RecordSection): Promise<void> {
  const member = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { completedSections: true },
  });
  if (member.completedSections.includes(section)) {
    return;
  }

  const completedSections = [...member.completedSections, section];
  const isNowComplete = recordProgress(completedSections).isComplete;

  await prisma.member.update({
    where: { id: memberId },
    data: {
      completedSections: { push: section },
      ...(isNowComplete
        ? {
            isRecordIncomplete: false,
            needsWingReview: true,
            wingReviewReason: "Record completed",
            wingReviewRequestedAt: new Date(),
          }
        : {}),
    },
  });

  if (isNowComplete) {
    await writeAudit({
      actorId: userId,
      action: "member.record_completed",
      entity: "Member",
      entityId: memberId,
      before: { isRecordIncomplete: true },
      after: { isRecordIncomplete: false, needsWingReview: true },
    });
  }
}
