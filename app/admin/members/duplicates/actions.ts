"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { canAccessWing } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";
import { dismissDuplicateFlagSchema } from "./schema";

// Dismiss only. Merging the two member records (reassigning payments,
// attendance and every other foreign key onto one surviving record) is a
// separate, larger feature that touches financial and audit integrity in
// ways this worklist does not decide on its own; it is not built here.
// This action only records that a human looked at the pair and the flag
// no longer needs attention, or leaves it pending for someone with wing
// access to do so.
export async function dismissDuplicateFlag(formData: FormData): Promise<void> {
  const parsed = dismissDuplicateFlagSchema.safeParse({ flagId: formData.get("flagId") });
  if (!parsed.success) {
    throw new Error("Missing flag id.");
  }

  const actor = await requireRole(["WING_ADMIN"]);

  const flag = await prisma.memberDuplicateFlag.findUnique({
    where: { id: parsed.data.flagId },
    include: { memberA: true, memberB: true },
  });
  if (!flag) {
    throw new Error("This duplicate flag no longer exists.");
  }

  if (!canAccessWing(actor, flag.memberA.wingId) && !canAccessWing(actor, flag.memberB.wingId)) {
    throw new Error("You do not have access to either member's wing.");
  }

  if (flag.status !== "PENDING") {
    throw new Error("This flag has already been decided.");
  }

  const updated = await prisma.memberDuplicateFlag.update({
    where: { id: flag.id },
    data: {
      status: "DISMISSED",
      dismissedById: actor.id,
      dismissedAt: new Date(),
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "member_duplicate_flag.dismissed",
    entity: "MemberDuplicateFlag",
    entityId: flag.id,
    before: { status: flag.status },
    after: { status: updated.status },
  });

  revalidatePath("/admin/members/duplicates");
}
