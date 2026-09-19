import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { DisbursementForm } from "./disbursement-form";

export default async function NewDisbursementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["CHARITY_OFFICER"]);
  const params = await searchParams;
  const preselectedCaseId = typeof params.caseId === "string" ? params.caseId : undefined;

  const [funds, cases] = await Promise.all([
    prisma.fund.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.charityCase.findMany({
      where: { status: { in: ["APPROVED", "DISBURSED"] } },
      orderBy: { approvedAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <BackLink
        href={preselectedCaseId ? `/admin/charity/cases/${preselectedCaseId}` : "/admin/charity"}
        label={preselectedCaseId ? "Back to case" : "Back to charity dashboard"}
      />
      <div>
        <h1 className="text-lg font-semibold">Record a disbursement</h1>
        <p className="text-sm text-muted-foreground">
          Draws from a specified fund against an approved case, and records who paid out.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Disbursement details</CardTitle>
        </CardHeader>
        <CardContent>
          <DisbursementForm funds={funds} cases={cases} preselectedCaseId={preselectedCaseId} />
        </CardContent>
      </Card>
    </div>
  );
}
