"use client";

import { useState } from "react";
import type { ContributionPlan, Wing } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/money";
import { PlanForm } from "./plan-form";

const FREQUENCY_LABELS: Record<string, string> = {
  ONE_OFF: "One off",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
};

export function PlanRow({
  plan,
  wings,
}: {
  plan: ContributionPlan & { wing: Wing | null };
  wings: Wing[];
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <PlanForm wings={wings} plan={plan} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-paper-dim p-3 text-sm">
      <span>
        <span className="font-medium">{plan.name}</span> &middot; {formatNaira(plan.amountKobo)} &middot;{" "}
        {FREQUENCY_LABELS[plan.frequency] ?? plan.frequency} &middot; {plan.wing?.name ?? "All wings"}
        {!plan.isActive ? <span className="text-muted-foreground"> &middot; Inactive</span> : null}
      </span>
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
        Edit
      </Button>
    </div>
  );
}
