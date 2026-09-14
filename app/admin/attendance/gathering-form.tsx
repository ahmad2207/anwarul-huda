"use client";

import { useActionState } from "react";
import type { Branch, Wing } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGathering } from "./actions";

const GATHERING_TYPES = [
  { value: "JUMUAH", label: "Jumu'ah" },
  { value: "TALEEM", label: "Ta'leem" },
  { value: "WING_MEETING", label: "Wing meeting" },
  { value: "GENERAL_MEETING", label: "General meeting" },
  { value: "PROGRAMME", label: "Programme" },
  { value: "OTHER", label: "Other" },
];

export function GatheringForm({ wings, branches }: { wings: Wing[]; branches: Branch[] }) {
  const [state, formAction, isPending] = useActionState(createGathering, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <Label className="text-xs">Title</Label>
        <Input name="title" placeholder="Jumu'ah, 19 September" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Type</Label>
        <select name="type" defaultValue="JUMUAH" className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          {GATHERING_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Wing</Label>
        <select name="wingId" defaultValue="" className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All wings</option>
          {wings.map((wing) => (
            <option key={wing.id} value={wing.id}>
              {wing.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Branch</Label>
        <select name="branchId" defaultValue="" className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Not assigned</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Starts</Label>
        <Input name="startsAt" type="datetime-local" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Ends (optional)</Label>
        <Input name="endsAt" type="datetime-local" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Creating..." : "Create gathering"}
      </Button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
