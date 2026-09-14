"use client";

import { useState, useTransition } from "react";
import type { ContributionPlan, Wing } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNaira } from "@/lib/money";
import { computePeriod } from "@/lib/contributions/period";
import { generateRecordsForPlan } from "./actions";

export function GeneratePanel({ plans }: { plans: Array<ContributionPlan & { wing: Wing | null }> }) {
  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">No active plans. Add one first.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {plans.map((plan) => (
        <PlanGenerateRow key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

function PlanGenerateRow({ plan }: { plan: ContributionPlan & { wing: Wing | null } }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const currentPeriod = computePeriod(plan.frequency);

  function handleGenerate() {
    setMessage(null);
    startTransition(async () => {
      const result = await generateRecordsForPlan(plan.id);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage(
        `Period ${result.periodLabel}: ${result.created} created, ${result.alreadyExisted} already existed (${result.totalInScope} members in scope).`,
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{plan.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {formatNaira(plan.amountKobo)} &middot; {plan.wing?.name ?? "All wings"} &middot; current period{" "}
          {currentPeriod.periodLabel}
        </p>
        <Button type="button" size="sm" onClick={handleGenerate} disabled={isPending} className="self-start">
          {isPending ? "Generating..." : `Generate for ${currentPeriod.periodLabel}`}
        </Button>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
