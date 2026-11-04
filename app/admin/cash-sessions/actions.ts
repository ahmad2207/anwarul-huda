"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { MoneyError, parseNairaText } from "@/lib/money";
import { closeSession } from "@/lib/cash-sessions/close-session";
import { closeSessionSchema, openSessionSchema } from "./schema";

export interface ActionState {
  error?: string;
}

// A float or a count can be zero (an empty till), but never negative.
function nairaStringToKobo(value: string): { amountKobo: number } | { error: string } {
  try {
    return { amountKobo: parseNairaText(value || "0", { allowZero: true }) };
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
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const floatResult = nairaStringToKobo(parsed.data.openingFloat);
  if ("error" in floatResult) return floatResult;

  // One open session per officer, so every cash payment has exactly one
  // till to land in and no session is left open and never reconciled.
  // The officer's user row is locked first so two opens at the same
  // moment cannot both pass the check.
  const opened = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id} FOR UPDATE`;
    const existing = await tx.cashSession.findFirst({ where: { openedById: actor.id, status: "OPEN" } });
    if (existing) {
      return { error: `You already have an open cash session, "${existing.label}". Close it before opening another.` };
    }

    const session = await tx.cashSession.create({
      data: {
        label: parsed.data.label,
        openedById: actor.id,
        openedAt: new Date(),
        openingFloatKobo: floatResult.amountKobo,
        status: "OPEN",
      },
    });

    await writeAudit(
      {
        actorId: actor.id,
        action: "cash_session.opened",
        entity: "CashSession",
        entityId: session.id,
        before: null,
        after: session,
      },
      tx,
    );
    return {};
  });
  if ("error" in opened) return opened;

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
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
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
