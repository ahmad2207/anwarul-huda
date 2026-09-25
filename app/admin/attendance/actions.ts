"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";
import { createGatheringFormDataToRaw, createGatheringSchema } from "./schema";

export interface ActionState {
  error?: string;
}

export async function createGathering(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);

  const parsed = createGatheringSchema.safeParse(createGatheringFormDataToRaw(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const wingId = parsed.data.wingId ?? null;

  // A wing administrator can only ever run check-in for their own wing
  // (CLAUDE.md domain rule 5), so they cannot create a gathering open to
  // all wings, or scoped to a wing that is not theirs, either: that
  // would create a gathering nobody with "own wing" access could ever
  // check anyone in to (an attendance officer or super admin still
  // could, but the wing admin who made it could not).
  if (!canViewAllWings(actor) && !actor.roles.includes("ATTENDANCE_OFFICER")) {
    if (!wingId || !actor.wingIds.includes(wingId)) {
      return { error: "Choose your own wing for this gathering." };
    }
  }

  const created = await prisma.gathering.create({
    data: {
      title: parsed.data.title,
      type: parsed.data.type,
      wingId,
      branchId: parsed.data.branchId ?? null,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt ?? null,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "gathering.created",
    entity: "Gathering",
    entityId: created.id,
    before: null,
    after: created,
  });

  revalidatePath("/admin/attendance");
  return {};
}

export async function closeGathering(gatheringId: string): Promise<void> {
  const actor = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);

  const gathering = await prisma.gathering.findUnique({ where: { id: gatheringId } });
  if (!gathering) {
    throw new Error("This gathering no longer exists.");
  }
  if (gathering.isClosed) {
    throw new Error("This gathering is already closed.");
  }
  if (
    !canViewAllWings(actor) &&
    !actor.roles.includes("ATTENDANCE_OFFICER") &&
    (!gathering.wingId || !actor.wingIds.includes(gathering.wingId))
  ) {
    throw new Error("You do not have access to this gathering.");
  }

  const updated = await prisma.gathering.update({
    where: { id: gatheringId },
    data: { isClosed: true },
  });

  await writeAudit({
    actorId: actor.id,
    action: "gathering.closed",
    entity: "Gathering",
    entityId: gatheringId,
    before: gathering,
    after: updated,
  });

  revalidatePath("/admin/attendance");
  revalidatePath(`/admin/attendance/${gatheringId}`);
}
