"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { resolveFaceMatchAction } from "./actions";

const OUTCOMES = [
  {
    value: "INDISTINGUISHABLE",
    label: "Different people",
    help: "Both are checked in by name from now on. Any saved face is removed and neither is asked about face again.",
  },
  {
    value: "SAME_PERSON",
    label: "Same person, two records",
    help: "Records the decision. Then deactivate the duplicate record from its member page.",
  },
  {
    value: "DISMISSED",
    label: "Not a real match",
    help: "The member can set up face check-in again, and this pair will not be flagged again.",
  },
] as const;

export function ResolveFaceMatchForm({ caseId }: { caseId: string }) {
  const [state, formAction, isPending] = useActionState(resolveFaceMatchAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium">What is this pair?</legend>
        {OUTCOMES.map((outcome) => (
          <label key={outcome.value} className="flex items-start gap-2 text-sm">
            <input type="radio" name="outcome" value={outcome.value} required className="mt-1" />
            <span>
              <span className="font-medium">{outcome.label}</span>
              <span className="block text-xs text-muted-foreground">{outcome.help}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`note-${caseId}`} className="text-xs">
          Reason (recorded with your name)
        </Label>
        <textarea
          id={`note-${caseId}`}
          name="note"
          rows={2}
          required
          maxLength={1000}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-sabon">{state.message}</p> : null}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : "Record decision"}
      </Button>
    </form>
  );
}
