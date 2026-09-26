"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { recordWillNotUseFaceAction } from "./actions";

// Two steps, so a member is never taken off the list by a stray tap: this
// is permanent, and they are checked in by name from then on.
export function DeclineFaceForm({ memberId }: { memberId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(recordWillNotUseFaceAction, {});

  if (state.done) {
    return <p className="text-xs text-muted-foreground">Checked in by name from now on.</p>;
  }
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Will not use face check-in
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <p className="text-xs text-muted-foreground">
        They will be checked in by name at every gathering and will not appear on this list again.
      </p>
      <label className="flex flex-col gap-1 text-xs">
        Note (optional, only the office sees it)
        <input name="note" maxLength={500} className="h-8 rounded-md border border-input bg-background px-2 text-sm" />
      </label>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : "Confirm"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
