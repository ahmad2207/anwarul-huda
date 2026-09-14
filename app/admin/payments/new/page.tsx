import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentForm } from "./payment-form";

export default async function NewPaymentPage() {
  await requireRole(["FINANCE_OFFICER"]);

  const [plans, funds] = await Promise.all([
    prisma.contributionPlan.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.fund.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">New payment</h1>
        <p className="text-sm text-muted-foreground">
          Search for the member, pick the plan or fund, and record the payment.
        </p>
      </div>
      <PaymentForm plans={plans} funds={funds} />
    </div>
  );
}
