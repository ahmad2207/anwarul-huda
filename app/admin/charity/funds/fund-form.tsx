"use client";

import { useActionState } from "react";
import type { Fund } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFund, updateFund } from "./actions";

const FUND_TYPES = [
  { value: "ZAKAT", label: "Zakat" },
  { value: "SADAQAH", label: "Sadaqah" },
  { value: "WAQF", label: "Waqf" },
  { value: "GENERAL", label: "General or operational" },
  { value: "APPEAL", label: "Special appeal" },
];

export function FundForm({ fund, onDone }: { fund?: Fund; onDone?: () => void }) {
  const boundAction = fund ? updateFund.bind(null, fund.id) : createFund;
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
        <Input name="name" defaultValue={fund?.name} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Type</Label>
        <select
          name="type"
          defaultValue={fund?.type ?? "GENERAL"}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {FUND_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <Label className="text-xs">Description</Label>
        <Input name="description" defaultValue={fund?.description ?? ""} />
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={fund?.isActive ?? true} />
        Active
      </label>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving..." : fund ? "Save changes" : "Add fund"}
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
