"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCaseAction } from "../actions";

const ZAKAT_CATEGORIES = [
  { value: "FUQARA", label: "Fuqara (the poor)" },
  { value: "MASAKIN", label: "Masakin (the needy)" },
  { value: "AMILIN", label: "Amilin (zakat administrators)" },
  { value: "MUALLAFAT", label: "Muallafat (reconciled hearts)" },
  { value: "RIQAB", label: "Riqab (freeing captives)" },
  { value: "GHARIMIN", label: "Gharimin (those in debt)" },
  { value: "FI_SABILILLAH", label: "Fi sabilillah (in the cause of Allah)" },
  { value: "IBN_SABIL", label: "Ibn sabil (the stranded traveller)" },
];

export function NewCaseForm() {
  const [state, formAction, isPending] = useActionState(createCaseAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-medium">Beneficiary</legend>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Name</Label>
          <Input name="beneficiaryName" required />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Phone</Label>
          <Input name="beneficiaryPhone" />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label className="text-xs">Address</Label>
          <Input name="beneficiaryAddress" />
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="isMember" />
          This beneficiary is a member
        </label>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Linked member id (optional)</Label>
          <Input name="linkedMemberId" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">The need</legend>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Description</Label>
          <textarea
            name="needDescription"
            rows={4}
            required
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Requested amount (Naira)</Label>
            <Input name="requested" type="number" step="0.01" min="0.01" className="w-32" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Zakat category (only if this will be zakat funded)</Label>
            <select
              name="zakatCategory"
              defaultValue=""
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Not a zakat case</option>
              {ZAKAT_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Creating..." : "Create case"}
      </Button>
    </form>
  );
}
