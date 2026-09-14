import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GeneratePanel } from "./generate-panel";

export default async function GenerateContributionsPage() {
  await requireRole(["FINANCE_OFFICER"]);

  const plans = await prisma.contributionPlan.findMany({
    where: { isActive: true },
    include: { wing: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Generate contribution records</h1>
        <p className="text-sm text-muted-foreground">
          Creates the expected contribution for every active member in a plan&apos;s scope, for that
          plan&apos;s current period. Running this again for the same period changes nothing.
        </p>
      </div>
      <GeneratePanel plans={plans} />
    </div>
  );
}
