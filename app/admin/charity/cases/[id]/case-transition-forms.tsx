"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveCaseAction,
  closeCaseAction,
  recommendCaseAction,
  rejectCaseAction,
  verifyCaseAction,
} from "../actions";

export function VerifyButton({ caseId }: { caseId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              await verifyCaseAction(caseId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Something went wrong verifying this case. Try again.");
            }
          })
        }
      >
        {isPending ? "Verifying..." : "Verify"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function RecommendForm({ caseId }: { caseId: string }) {
  const boundAction = recommendCaseAction.bind(null, caseId);
  const [state, formAction, isPending] = useActionState(boundAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border bg-paper-dim p-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Recommended amount (Naira)</Label>
        <Input name="recommended" type="number" step="0.01" min="0.01" className="w-32" required />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Recommending..." : "Recommend"}
      </Button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function ApproveForm({ caseId }: { caseId: string }) {
  const boundAction = approveCaseAction.bind(null, caseId);
  const [state, formAction, isPending] = useActionState(boundAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border bg-paper-dim p-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Approved amount (Naira)</Label>
        <Input name="approved" type="number" step="0.01" min="0.01" className="w-32" required />
      </div>
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <Label className="text-xs">Decision note (optional)</Label>
        <Input name="decisionNote" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Approving..." : "Approve"}
      </Button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function RejectForm({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const boundAction = rejectCaseAction.bind(null, caseId);
  const [state, formAction, isPending] = useActionState(boundAction, {});

  if (!open) {
    return (
      <Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Reject
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border bg-paper-dim p-3">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <Label className="text-xs">Reason</Label>
        <Input name="reason" required minLength={3} />
      </div>
      <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
        {isPending ? "Rejecting..." : "Confirm reject"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function CloseButton({ caseId }: { caseId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              await closeCaseAction(caseId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Something went wrong closing this case. Try again.");
            }
          })
        }
      >
        {isPending ? "Closing..." : "Close case"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
