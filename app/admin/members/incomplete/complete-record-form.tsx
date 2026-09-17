"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeIncompleteMember } from "./actions";

export function CompleteRecordForm({ memberId }: { memberId: string }) {
  const [open, setOpen] = useState(false);
  const [noPhoneOnFile, setNoPhoneOnFile] = useState(false);
  const [error, formAction, isPending] = useActionState(completeIncompleteMember, undefined);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Complete record
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex min-w-72 flex-col gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-32 flex-1 flex-col gap-1">
          <Label htmlFor={`surname-${memberId}`} className="text-xs">
            Surname
          </Label>
          <Input id={`surname-${memberId}`} name="surname" required />
        </div>
        <div className="flex min-w-32 flex-1 flex-col gap-1">
          <Label htmlFor={`firstName-${memberId}`} className="text-xs">
            First name
          </Label>
          <Input id={`firstName-${memberId}`} name="firstName" required />
        </div>
      </div>
      <div className="flex min-w-48 flex-col gap-1">
        <Label htmlFor={`phone-${memberId}`} className="text-xs">
          Phone
        </Label>
        <Input
          id={`phone-${memberId}`}
          name="phone"
          type="tel"
          disabled={noPhoneOnFile}
          placeholder={noPhoneOnFile ? "No phone on file" : undefined}
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="noPhoneOnFile"
          checked={noPhoneOnFile}
          onChange={(event) => setNoPhoneOnFile(event.target.checked)}
        />
        This member genuinely has no phone on file, distinct from not having asked yet
      </label>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
