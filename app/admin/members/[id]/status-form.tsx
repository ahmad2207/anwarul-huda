"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMemberStatus } from "./actions";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "OCCASIONAL", label: "Occasional" },
  { value: "RELOCATED", label: "Relocated" },
  { value: "HONORARY", label: "Honorary" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DECEASED", label: "Deceased" },
] as const;

export function StatusChangeForm({ memberId, currentStatus }: { memberId: string; currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const boundAction = changeMemberStatus.bind(null, memberId);
  const [state, formAction, isPending] = useActionState(boundAction, {});

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Change status
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border p-3">
      <p className="text-sm font-medium">
        Change status (currently {currentStatus.charAt(0) + currentStatus.slice(1).toLowerCase()})
      </p>
      <p className="text-xs text-muted-foreground">
        The member record is never deleted. This only records a new status, with a reason and a date.
      </p>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="status" className="text-xs">New status</Label>
          <select
            id="status"
            name="status"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            {STATUS_OPTIONS.filter((option) => option.value !== currentStatus).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="effectiveDate" className="text-xs">Effective date</Label>
          <Input id="effectiveDate" name="effectiveDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label htmlFor="reason" className="text-xs">Reason</Label>
          <Input id="reason" name="reason" required minLength={3} />
        </div>
      </div>

      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Confirm status change"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
