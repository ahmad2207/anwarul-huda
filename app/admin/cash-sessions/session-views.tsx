"use client";

import { useActionState, useState } from "react";
import type { CashSession, User } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNaira } from "@/lib/money";
import { StatusTag } from "@/components/status-tag";
import { closeCashSession, openCashSession } from "./actions";

export function OpenSessionForm() {
  const [state, formAction, isPending] = useActionState(openCashSession, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Open a cash session</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Label</Label>
            <Input name="label" placeholder="Jumu'ah collection" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Opening float (Naira)</Label>
            <Input name="openingFloat" type="number" step="0.01" min="0" defaultValue="0" className="w-32" />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Opening..." : "Open session"}
          </Button>
          {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}

type SessionWithUsers = CashSession & { openedBy: User; closedBy: User | null };

export function SessionRow({ session }: { session: SessionWithUsers }) {
  const [closing, setClosing] = useState(false);
  const boundClose = closeCashSession.bind(null, session.id);
  const [state, formAction, isPending] = useActionState(boundClose, {});

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{session.label}</span> &middot; opened by{" "}
          {session.openedBy.email ?? session.openedBy.phone} &middot;{" "}
          {session.openedAt.toLocaleString("en-NG")} &middot; float {formatNaira(session.openingFloatKobo)}
        </span>
        {session.status === "OPEN" ? (
          <div className="flex items-center gap-2">
            <StatusTag tone="neutral">Open</StatusTag>
            <Button type="button" size="sm" variant="outline" onClick={() => setClosing((v) => !v)}>
              {closing ? "Cancel" : "Close session"}
            </Button>
          </div>
        ) : (
          <StatusTag tone="neutral">Closed</StatusTag>
        )}
      </div>

      {session.status === "CLOSED" ? (
        <p className="text-xs text-muted-foreground">
          Expected {formatNaira(session.expectedCashKobo ?? 0)}, counted{" "}
          {formatNaira(session.countedCashKobo ?? 0)}, variance{" "}
          {(session.varianceKobo ?? 0) !== 0 ? (
            <StatusTag tone="attention">{formatNaira(session.varianceKobo ?? 0)}</StatusTag>
          ) : (
            <span className="font-medium">{formatNaira(session.varianceKobo ?? 0)}</span>
          )}
          {session.varianceNote ? ` (${session.varianceNote})` : ""}
        </p>
      ) : null}

      {closing ? (
        <form action={formAction} className="flex flex-wrap items-end gap-2 border-t pt-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Counted cash (Naira)</Label>
            <Input name="counted" type="number" step="0.01" min="0" className="w-32" required />
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1">
            <Label className="text-xs">Variance note (required if not exact)</Label>
            <Input name="varianceNote" />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Closing..." : "Confirm close"}
          </Button>
          {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
