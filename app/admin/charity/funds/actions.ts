"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { updateFundRecord } from "@/lib/charity/update-fund";
import { fundFormDataToRaw, fundSchema } from "./schema";

export interface ActionState {
  error?: string;
}

export async function createFund(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["CHARITY_OFFICER"]);

  const parsed = fundSchema.safeParse(fundFormDataToRaw(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const fund = await prisma.fund.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      description: parsed.data.description ?? null,
      isActive: parsed.data.isActive,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "fund.created",
    entity: "Fund",
    entityId: fund.id,
    before: null,
    after: fund,
  });

  revalidatePath("/admin/charity/funds");
  return {};
}

export async function updateFund(
  fundId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["CHARITY_OFFICER"]);

  const parsed = fundSchema.safeParse(fundFormDataToRaw(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const result = await prisma.$transaction((tx) =>
    updateFundRecord(
      tx,
      fundId,
      {
        name: parsed.data.name,
        type: parsed.data.type,
        description: parsed.data.description ?? null,
        isActive: parsed.data.isActive,
      },
      actor.id,
    ),
  );
  if ("error" in result) return { error: result.error };

  revalidatePath("/admin/charity/funds");
  return {};
}
