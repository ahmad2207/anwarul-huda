"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rejectMember } from "./actions";

export function RejectMemberForm({ memberId }: { memberId: string }) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(rejectMember, undefined);

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Reject
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-1 flex-wrap items-end gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <Label htmlFor={`reason-${memberId}`} className="text-xs">
          Reason for rejection
        </Label>
        <Input id={`reason-${memberId}`} name="reason" required minLength={3} />
      </div>
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? "Rejecting..." : "Confirm reject"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
