"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { computePeriod } from "@/lib/contributions/period";

export interface GenerateResult {
  error?: string;
  periodLabel?: string;
  totalInScope?: number;
  created?: number;
  alreadyExisted?: number;
}

/**
 * Generates one ContributionRecord per active member in a plan's scope,
 * for the plan's current period. Idempotent: running this twice for the
 * same period creates nothing the second time, because it is a bulk
 * insert guarded by the same unique constraint
 * (memberId, planId, periodLabel) that would otherwise reject a
 * duplicate one row at a time.
 */
export async function generateRecordsForPlan(planId: string): Promise<GenerateResult> {
  const actor = await requireRole(["FINANCE_OFFICER"]);

  const plan = await prisma.contributionPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    return { error: "This plan no longer exists." };
  }
  if (!plan.isActive) {
    return { error: "This plan is not active." };
  }

  const period = computePeriod(plan.frequency);

  const members = await prisma.member.findMany({
    where: {
      status: "ACTIVE",
      ...(plan.wingId ? { wingId: plan.wingId } : {}),
    },
    select: { id: true },
  });

  const result = await prisma.contributionRecord.createMany({
    data: members.map((member) => ({
      memberId: member.id,
      planId: plan.id,
      periodLabel: period.periodLabel,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      amountDueKobo: plan.amountKobo,
    })),
    skipDuplicates: true,
  });

  await writeAudit({
    actorId: actor.id,
    action: "contribution_records.generated",
    entity: "ContributionPlan",
    entityId: plan.id,
    before: null,
    after: {
      periodLabel: period.periodLabel,
      totalInScope: members.length,
      created: result.count,
    },
  });

  revalidatePath("/admin/contributions/generate");

  return {
    periodLabel: period.periodLabel,
    totalInScope: members.length,
    created: result.count,
    alreadyExisted: members.length - result.count,
  };
}
