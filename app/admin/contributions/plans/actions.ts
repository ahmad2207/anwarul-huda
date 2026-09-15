"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { MoneyError, nairaToKobo } from "@/lib/money";
import { planFormDataToRaw, planSchema } from "./schema";

export interface ActionState {
  error?: string;
}

function toAmountKobo(amount: string): { amountKobo: number } | { error: string } {
  const naira = Number(amount);
  if (!Number.isFinite(naira) || naira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }
  try {
    return { amountKobo: nairaToKobo(naira) };
  } catch (error) {
    return { error: error instanceof MoneyError ? error.message : "Invalid amount." };
  }
}

export async function createPlan(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["FINANCE_OFFICER"]);

  const parsed = planSchema.safeParse(planFormDataToRaw(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const amount = toAmountKobo(parsed.data.amount);
  if ("error" in amount) return amount;

  const plan = await prisma.contributionPlan.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      amountKobo: amount.amountKobo,
      frequency: parsed.data.frequency,
      wingId: parsed.data.wingId ?? null,
      isActive: parsed.data.isActive,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "contribution_plan.created",
    entity: "ContributionPlan",
    entityId: plan.id,
    before: null,
    after: plan,
  });

  revalidatePath("/admin/contributions/plans");
  return {};
}

export async function updatePlan(
  planId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["FINANCE_OFFICER"]);

  const parsed = planSchema.safeParse(planFormDataToRaw(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const amount = toAmountKobo(parsed.data.amount);
  if ("error" in amount) return amount;

  const before = await prisma.contributionPlan.findUnique({ where: { id: planId } });
  if (!before) {
    return { error: "This plan no longer exists." };
  }

  const updated = await prisma.contributionPlan.update({
    where: { id: planId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      amountKobo: amount.amountKobo,
      frequency: parsed.data.frequency,
      wingId: parsed.data.wingId ?? null,
      isActive: parsed.data.isActive,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "contribution_plan.updated",
    entity: "ContributionPlan",
    entityId: planId,
    before,
    after: updated,
  });

  revalidatePath("/admin/contributions/plans");
  return {};
}
