"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { MoneyError, nairaToKobo } from "@/lib/money";
import { recordPayment } from "@/lib/payments/record-payment";
import { formatMemberName } from "@/lib/members/display-name";
import { paymentFormDataToRaw, paymentSchema } from "./schema";

export interface MemberSearchResult {
  id: string;
  label: string;
  memberNumber: string | null;
  phone: string | null;
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

  const naira = Number(data.amount);
  if (!Number.isFinite(naira) || naira <= 0) {
    return { error: "Enter an amount greater than zero." };
  }
  let amountKobo: number;
  try {
    amountKobo = nairaToKobo(naira);
  } catch (error) {
    return { error: error instanceof MoneyError ? error.message : "Invalid amount." };
  }

  const member = await prisma.member.findUnique({ where: { id: data.memberId } });
  if (!member) {
    return { error: "This member no longer exists." };
  }

  const plan =
    data.targetType === "plan"
      ? await prisma.contributionPlan.findUnique({ where: { id: data.targetId } })
      : null;
  if (data.targetType === "plan" && (!plan || !plan.isActive)) {
    return { error: "Choose a valid, active plan." };
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
  let cashSessionId: string | null = null;
  if (data.method === "CASH") {
    const session = await prisma.cashSession.findFirst({
      where: { openedById: actor.id, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });
    if (!session) {
      return { error: "Open a cash session before recording a cash payment." };
    }
    cashSessionId = session.id;
  }

  const payment = await prisma.$transaction((tx) =>
    recordPayment(tx, {
      memberId: member.id,
      amountKobo,
      method: data.method,
      reference: data.reference ?? null,
      narration: data.narration ?? null,
      actorId: actor.id,
      cashSessionId,
      plan: plan ? { id: plan.id, frequency: plan.frequency, amountKobo: plan.amountKobo } : null,
      fundId: fund?.id ?? null,
    }),
  );

  revalidatePath("/admin/payments/new");
  return { paymentId: payment.id };
}
