import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanRow } from "./plan-row";
import { PlanForm } from "./plan-form";

export default async function ContributionPlansPage() {
  await requireRole(["FINANCE_OFFICER"]);

  const [plans, wings] = await Promise.all([
    prisma.contributionPlan.findMany({ include: { wing: true }, orderBy: { createdAt: "asc" } }),
    prisma.wing.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Contribution plans</h1>
        <p className="text-sm text-muted-foreground">
          Monthly dues, building fund, Eid levy and so on. Each plan has an amount, a frequency and a
          scope.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Plans</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {plans.map((plan) => (
            <PlanRow key={plan.id} plan={plan} wings={wings} />
          ))}
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plans yet.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Add a plan</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanForm wings={wings} />
        </CardContent>
      </Card>
    </div>
  );
}
