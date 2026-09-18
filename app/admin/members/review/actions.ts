"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireWingAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// A light review, not an approval (MEMBER-INTERFACE.md 3.4, M3 #9): the
// member's own status, wing and membership fields are untouched by
// this. Marking it done only clears the flag that put them on this
// worklist in the first place.
export async function markWingReviewDone(formData: FormData): Promise<void> {
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) {
    throw new Error("Missing id.");
  }

  const actor = await requireRole(["WING_ADMIN"]);

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw new Error("This member record no longer exists.");
  }
  await requireWingAccess(member.wingId);

  if (!member.needsWingReview) {
    return;
  }

  await prisma.member.update({
    where: { id: memberId },
    data: { needsWingReview: false, wingReviewReason: null, wingReviewRequestedAt: null },
  });

  await writeAudit({
    actorId: actor.id,
    action: "member.wing_review_completed",
    entity: "Member",
    entityId: memberId,
    before: { needsWingReview: true, wingReviewReason: member.wingReviewReason },
    after: { needsWingReview: false },
  });

  revalidatePath("/admin/members/review");
}
