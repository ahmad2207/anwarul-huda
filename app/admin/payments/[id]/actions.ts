"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { applyVoid } from "@/lib/payments/void-payment";
import { voidPaymentSchema } from "./schema";

export interface VoidActionState {
  error?: string;
}

export async function voidPayment(
  paymentId: string,
  _previousState: VoidActionState,
  formData: FormData,
): Promise<VoidActionState> {
  const actor = await requireRole(["FINANCE_OFFICER"]);

  const parsed = voidPaymentSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    return { error: "This payment no longer exists." };
  }
  if (payment.status === "VOIDED") {
    return { error: "This payment has already been voided." };
  }

  await prisma.$transaction((tx) => applyVoid(tx, payment, parsed.data.reason, actor.id));

  revalidatePath(`/admin/payments/${paymentId}`);
  return {};
}
