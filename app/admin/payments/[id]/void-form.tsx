"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { voidPayment } from "./actions";

export function VoidForm({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const boundAction = voidPayment.bind(null, paymentId);
  const [state, formAction, isPending] = useActionState(boundAction, {});

  if (!open) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Void this payment
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <Label className="text-xs">Reason for voiding</Label>
        <Input name="reason" required minLength={3} />
      </div>
      <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
        {isPending ? "Voiding..." : "Confirm void"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
