"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContributionPlan, Fund } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPayment, loadPayablePeriods, searchMembers } from "./actions";
import type { MemberSearchResult, PayablePeriodOption } from "./actions";

export function PaymentForm({
  plans,
  funds,
}: {
  plans: ContributionPlan[];
  funds: Fund[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createPayment, {});

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [targetType, setTargetType] = useState<"plan" | "fund">("plan");
  const [targetId, setTargetId] = useState("");
  const [method, setMethod] = useState<"CASH" | "POS" | "BANK_TRANSFER">("CASH");
  const [periods, setPeriods] = useState<PayablePeriodOption[]>([]);

  // Only plans for every wing, or for the chosen member's own wing.
  const availablePlans = selectedMember
    ? plans.filter((plan) => !plan.wingId || plan.wingId === selectedMember.wingId)
    : plans;

  useEffect(() => {
    if (state.paymentId) {
      router.push(`/admin/payments/${state.paymentId}`);
    }
  }, [state.paymentId, router]);

  // The periods this payment can settle, oldest unpaid first, reloaded
  // whenever the member or plan changes.
  useEffect(() => {
    if (!selectedMember || targetType !== "plan" || !targetId) {
      setPeriods([]);
      return;
    }
    let cancelled = false;
    loadPayablePeriods(selectedMember.id, targetId)
      .then((found) => {
        if (!cancelled) setPeriods(found);
      })
      .catch(() => {
        if (!cancelled) setPeriods([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMember, targetType, targetId]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedMember(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const found = await searchMembers(value);
      setResults(found);
    }, 250);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record a payment</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="memberId" value={selectedMember?.id ?? ""} />

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Member: name, phone or number</Label>
            <Input
              value={selectedMember ? selectedMember.label : query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Search..."
            />
            {results.length > 0 && !selectedMember ? (
              <ul className="mt-1 flex flex-col gap-1 rounded-md border bg-card p-1 shadow-[0_16px_30px_-16px_rgba(4,20,40,0.3)]">
                {results.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setSelectedMember(result);
                        setTargetId("");
                        setResults([]);
                      }}
                    >
                      {result.label} &middot; {result.phone} &middot; {result.wingName}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="targetType"
                value="plan"
                checked={targetType === "plan"}
                onChange={() => {
                  setTargetType("plan");
                  setTargetId("");
                }}
              />
              Contribution plan
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="targetType"
                value="fund"
                checked={targetType === "fund"}
                onChange={() => {
                  setTargetType("fund");
                  setTargetId("");
                }}
              />
              Fund donation
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="payment-target" className="text-xs">
              {targetType === "plan" ? "Plan" : "Fund"}
            </Label>
            <select
              id="payment-target"
              name="targetId"
              required
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Choose...</option>
              {(targetType === "plan" ? availablePlans : funds).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          {targetType === "plan" && periods.length > 0 ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="payment-period" className="text-xs">
                Period this payment is for
              </Label>
              {/* Keyed on the list so the default resets to the oldest
                  unpaid period whenever the member or plan changes. */}
              <select
                key={periods.map((period) => period.periodLabel).join("|")}
                id="payment-period"
                name="periodLabel"
                defaultValue={periods[0]?.periodLabel}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {periods.map((period) => (
                  <option key={period.periodLabel} value={period.periodLabel}>
                    {period.label}
                    {period.isCurrent ? " (current)" : ""}, {period.outstanding} outstanding
                  </option>
                ))}
              </select>
              {periods.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                  The oldest unpaid period is chosen first. Change it only if the member asked to pay a different one.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Amount (Naira)</Label>
              <Input name="amount" type="number" step="0.01" min="0.01" className="w-32" required />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Method</Label>
              <select
                name="method"
                value={method}
                onChange={(event) => setMethod(event.target.value as typeof method)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="CASH">Cash</option>
                <option value="POS">POS</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
              </select>
            </div>

            {method !== "CASH" ? (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Reference</Label>
                <Input name="reference" required />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Narration (optional)</Label>
            <Input name="narration" />
          </div>

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <Button type="submit" disabled={isPending || !selectedMember} className="self-start">
            {isPending ? "Recording..." : "Record payment"}
          </Button>
          {!selectedMember ? (
            <p className="text-xs text-muted-foreground">Search for and select a member first.</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
