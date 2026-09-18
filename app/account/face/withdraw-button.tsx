"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { withdrawFaceEnrolment } from "./actions";

// SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md 4.2 and B1 #6: one action, no
// reason, no administrator, hard delete, "no confirmation beyond a
// single are-you-sure". The reveal below, matching how a destructive
// action is already confirmed elsewhere in this app (see
// app/admin/charity/cases/[id]/case-transition-forms.tsx), is that one
// are-you-sure: a second, plainer question would be one confirmation
// too many for what the addendum asks for.
export function WithdrawFaceEnrolmentButton() {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirming(true)}
        className="h-11 rounded-[4px] px-6 text-base"
      >
        Remove face check-in
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[4px] border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-base font-medium">Remove face check-in?</p>
      <p className="text-base text-muted-foreground">
        This deletes it immediately. Nobody needs to approve it, and you can set it up again later if you
        change your mind.
      </p>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="destructive"
          disabled={isPending}
          onClick={() => startTransition(() => withdrawFaceEnrolment())}
          className="h-11 rounded-[4px] px-6 text-base"
        >
          {isPending ? "Removing..." : "Yes, remove it"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="h-11 rounded-[4px] px-6 text-base"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
