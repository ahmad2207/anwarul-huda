"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setFaceThresholdsAction } from "./actions";

export function ThresholdForm({ matchThreshold, minMargin }: { matchThreshold: number; minMargin: number }) {
  const [state, formAction, isPending] = useActionState(setFaceThresholdsAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="matchThreshold" className="text-xs">
            Check-in threshold (0 to 1)
          </Label>
          <Input id="matchThreshold" name="matchThreshold" type="number" step="0.01" min="0.01" max="0.99" defaultValue={matchThreshold} required className="w-32" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="minMargin" className="text-xs">
            Minimum margin over the runner-up
          </Label>
          <Input id="minMargin" name="minMargin" type="number" step="0.01" min="0" max="0.5" defaultValue={minMargin} required className="w-32" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="note" className="text-xs">
          Why (recorded with your name)
        </Label>
        <textarea id="note" name="note" rows={2} required maxLength={1000} className="rounded-md border border-input bg-background px-2 py-1 text-sm" />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.saved ? <p className="text-sm text-sabon">Saved. It applies from the next check-in.</p> : null}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : "Save new threshold"}
      </Button>
    </form>
  );
}
