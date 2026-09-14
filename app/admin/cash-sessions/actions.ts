"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { MoneyError, nairaToKobo } from "@/lib/money";
import { closeSession } from "@/lib/cash-sessions/close-session";
import { closeSessionSchema, openSessionSchema } from "./schema";

export interface ActionState {
  error?: string;
}

function nairaStringToKobo(value: string): { amountKobo: number } | { error: string } {
  const naira = Number(value || "0");
  if (!Number.isFinite(naira) || naira < 0) {
    return { error: "Enter a valid amount." };
  }
  try {
    return { amountKobo: nairaToKobo(naira) };
  } catch (error) {
    return { error: error instanceof MoneyError ? error.message : "Invalid amount." };
  }
}

export async function openCashSession(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["FINANCE_OFFICER"]);

  const parsed = openSessionSchema.safeParse({
    label: formData.get("label"),
    openingFloat: formData.get("openingFloat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const floatResult = nairaStringToKobo(parsed.data.openingFloat);
  if ("error" in floatResult) return floatResult;

  const session = await prisma.cashSession.create({
    data: {
      label: parsed.data.label,
      openedById: actor.id,
      openedAt: new Date(),
      openingFloatKobo: floatResult.amountKobo,
      status: "OPEN",
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "cash_session.opened",
    entity: "CashSession",
    entityId: session.id,
    before: null,
    after: session,
  });

  revalidatePath("/admin/cash-sessions");
  return {};
}

export async function closeCashSession(
  sessionId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole(["FINANCE_OFFICER"]);

  const parsed = closeSessionSchema.safeParse({
    counted: formData.get("counted"),
    varianceNote: formData.get("varianceNote"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const session = await prisma.cashSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return { error: "This cash session no longer exists." };
  }

  const countedResult = nairaStringToKobo(parsed.data.counted);
  if ("error" in countedResult) return countedResult;

  const result = await prisma.$transaction((tx) =>
    closeSession(tx, session, countedResult.amountKobo, parsed.data.varianceNote ?? null, actor.id),
  );

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/admin/cash-sessions");
  return {};
}
