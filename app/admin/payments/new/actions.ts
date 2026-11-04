"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatNaira, MoneyError, parseNairaText } from "@/lib/money";
import { recordPayment, RecordPaymentError } from "@/lib/payments/record-payment";
import { listPayablePeriods } from "@/lib/payments/payable-periods";
import { describePeriod } from "@/lib/contributions/period";
import { formatMemberName } from "@/lib/members/display-name";
import { paymentFormDataToRaw, paymentSchema } from "./schema";

export interface MemberSearchResult {
  id: string;
  label: string;
  memberNumber: string | null;
  phone: string | null;
  wingId: string;
  wingName: string;
}

export async function searchMembers(query: string): Promise<MemberSearchResult[]> {
  await requireRole(["FINANCE_OFFICER"]);

  const q = query.trim();
  if (q.length < 2) return [];

  const members = await prisma.member.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { surname: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { fullNameAsWritten: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { memberNumber: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { wing: true },
    take: 10,
    orderBy: { surname: "asc" },
  });

  return members.map((member) => ({
    id: member.id,
    label: `${formatMemberName(member)}${member.memberNumber ? ` (${member.memberNumber})` : ""}`,
    memberNumber: member.memberNumber,
    phone: member.phone,
    wingId: member.wingId,
    wingName: member.wing.name,
  }));
}

export interface PaymentActionState {
  error?: string;
  paymentId?: string;
}

export async function createPayment(
  _previousState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const actor = await requireRole(["FINANCE_OFFICER"]);

  const parsed = paymentSchema.safeParse(paymentFormDataToRaw(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }
  const data = parsed.data;

  let amountKobo: number;
  try {
    amountKobo = parseNairaText(data.amount);
  } catch (error) {
    return { error: error instanceof MoneyError ? error.message : "Invalid amount." };
  }

  const member = await prisma.member.findUnique({ where: { id: data.memberId } });
  if (!member) {
    return { error: "This member no longer exists." };
  }
  if (member.status !== "ACTIVE") {
    return { error: "Payments can only be recorded for an active member." };
  }

  const plan =
    data.targetType === "plan"
      ? await prisma.contributionPlan.findUnique({ where: { id: data.targetId } })
      : null;
  if (data.targetType === "plan" && (!plan || !plan.isActive)) {
    return { error: "Choose a valid, active plan." };
  }
  // A plan set for one wing only applies to that wing's members.
  if (plan?.wingId && plan.wingId !== member.wingId) {
    return { error: "This plan is for another wing. Choose a plan that applies to this member." };
  }

  const fund =
    data.targetType === "fund" ? await prisma.fund.findUnique({ where: { id: data.targetId } }) : null;
  if (data.targetType === "fund" && (!fund || !fund.isActive)) {
    return { error: "Choose a valid, active fund." };
  }

  // Cash has to attach to the officer's own open session, so it feeds
  // into that session's expected-versus-counted reconciliation. POS and
  // bank transfer are not physical cash in a till, so they never attach
  // to one.
  //
  // The session is looked up and locked inside the payment's own
  // transaction. Closing a session takes the same lock (see
  // lib/cash-sessions/close-session.ts), so a payment can never attach to
  // a session that closed while it was being recorded, and a close never
  // misses a payment that committed against it.
  let payment;
  try {
    payment = await prisma.$transaction(async (tx) => {
      let cashSessionId: string | null = null;
      if (data.method === "CASH") {
        const open = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM cash_sessions
          WHERE opened_by_id = ${actor.id} AND status = 'OPEN'
          ORDER BY opened_at DESC
          LIMIT 1
          FOR UPDATE
        `;
        if (open.length === 0) {
          throw new RecordPaymentError("Open a cash session before recording a cash payment.");
        }
        cashSessionId = open[0].id;
      }

      return recordPayment(tx, {
        memberId: member.id,
        amountKobo,
        method: data.method,
        reference: data.reference ?? null,
        narration: data.narration ?? null,
        actorId: actor.id,
        cashSessionId,
        plan: plan ? { id: plan.id, frequency: plan.frequency, amountKobo: plan.amountKobo } : null,
        periodLabel: data.periodLabel ?? null,
        fundId: fund?.id ?? null,
      });
    });
  } catch (error) {
    if (error instanceof RecordPaymentError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/admin/payments/new");
  return { paymentId: payment.id };
}

export interface PayablePeriodOption {
  periodLabel: string;
  label: string;
  outstanding: string;
  isCurrent: boolean;
}

/** The periods the payment form offers for a member and plan, oldest unpaid first. */
export async function loadPayablePeriods(memberId: string, planId: string): Promise<PayablePeriodOption[]> {
  await requireRole(["FINANCE_OFFICER"]);

  const plan = await prisma.contributionPlan.findUnique({ where: { id: planId } });
  if (!plan) return [];

  const periods = await listPayablePeriods(prisma, memberId, plan);
  return periods.map((period) => ({
    periodLabel: period.periodLabel,
    label: describePeriod(period.periodLabel),
    outstanding: formatNaira(period.outstandingKobo),
    isCurrent: period.isCurrent,
  }));
}
