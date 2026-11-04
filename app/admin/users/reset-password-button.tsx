"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { resetStaffPasswordAction } from "./actions";

// Two steps, so a password is never replaced by a stray tap: the person
// is signed out of it the moment it happens. The new temporary password is
// shown once, from this response alone, and never again.
export function ResetStaffPasswordButton({ userId, email }: { userId: string; email: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, formAction, isPending] = useActionState(resetStaffPasswordAction.bind(null, userId), {});

  if (state.result) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-sabon/40 bg-sabon-soft p-3 text-sm">
        <p className="font-medium">
          New temporary password for {state.result.email ?? "this account"}. Copy it now: it will not be shown again.
        </p>
        <p className="select-all rounded bg-background px-3 py-2 font-mono text-lg tracking-[0.2em]">
          {state.result.temporaryPassword}
        </p>
        <p className="text-xs text-muted-foreground">
          Give it to them in person or by phone, not in a group chat. They will be asked to choose their own password
          when they sign in.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => {
            void navigator.clipboard.writeText(state.result?.temporaryPassword ?? "");
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy password"}
        </Button>
      </div>
    );
  }

  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>
        Reset password
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 text-sm">
      <p className="text-xs text-muted-foreground">
        {email ?? "This account"} will need the new temporary password to sign in. Their current password stops working.
      </p>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Resetting..." : "Reset password"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
