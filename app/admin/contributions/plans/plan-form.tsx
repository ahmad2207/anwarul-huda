"use client";

import { useActionState } from "react";
import type { ContributionPlan, Wing } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { koboToNaira } from "@/lib/money";
import { createPlan, updatePlan } from "./actions";

const FREQUENCIES = [
  { value: "ONE_OFF", label: "One off" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "ANNUAL", label: "Annual" },
];

export function PlanForm({
  wings,
  plan,
  onDone,
}: {
  wings: Wing[];
  plan?: ContributionPlan;
  onDone?: () => void;
}) {
  const boundAction = plan ? updatePlan.bind(null, plan.id) : createPlan;
  const [state, formAction, isPending] = useActionState(boundAction, {});

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone?.();
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border bg-paper-dim p-3"
    >
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <Label className="text-xs">Name</Label>
        <Input name="name" defaultValue={plan?.name} required />
      </div>
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <Label className="text-xs">Description</Label>
        <Input name="description" defaultValue={plan?.description ?? ""} />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Amount (Naira)</Label>
        <Input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          className="w-28"
          defaultValue={plan ? koboToNaira(plan.amountKobo).toFixed(2) : ""}
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Frequency</Label>
        <select
          name="frequency"
          defaultValue={plan?.frequency ?? "MONTHLY"}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {FREQUENCIES.map((freq) => (
            <option key={freq.value} value={freq.value}>
              {freq.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Wing scope</Label>
        <select
          name="wingId"
          defaultValue={plan?.wingId ?? ""}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">All wings</option>
          {wings.map((wing) => (
            <option key={wing.id} value={wing.id}>
              {wing.name}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={plan?.isActive ?? true} />
        Active
      </label>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving..." : plan ? "Save changes" : "Add plan"}
      </Button>
      {onDone ? (
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      ) : null}
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
