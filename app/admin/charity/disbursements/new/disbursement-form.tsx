"use client";

import { useActionState } from "react";
import type { CharityCase, Fund } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDisbursementAction } from "./actions";

export function DisbursementForm({
  funds,
  cases,
  preselectedCaseId,
}: {
  funds: Fund[];
  cases: CharityCase[];
  preselectedCaseId?: string;
}) {
  const [state, formAction, isPending] = useActionState(createDisbursementAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Case</Label>
        <select
          name="caseId"
          defaultValue={preselectedCaseId ?? ""}
          required
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Choose...</option>
          {cases.map((charityCase) => (
            <option key={charityCase.id} value={charityCase.id}>
              {charityCase.reference} &middot; {charityCase.beneficiaryName}
              {charityCase.zakatCategory ? ` (${charityCase.zakatCategory})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Fund</Label>
        <select name="fundId" required className="h-8 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Choose...</option>
          {funds.map((fund) => (
            <option key={fund.id} value={fund.id}>
              {fund.name} ({fund.type})
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">
        A case with no zakat category cannot be paid from a zakat fund. This is enforced twice: once here,
        and again by the database itself.
      </p>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Amount (Naira)</Label>
          <Input name="amount" type="number" step="0.01" min="0.01" className="w-32" required />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Method</Label>
          <select name="method" className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            <option value="CASH">Cash</option>
            <option value="POS">POS</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Narration (optional)</Label>
        <Input name="narration" />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Evidence (optional)</Label>
        <Input name="evidence" type="file" />
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Recording..." : "Record disbursement"}
      </Button>
    </form>
  );
}
