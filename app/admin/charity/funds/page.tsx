import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFundBalance } from "@/lib/charity/fund-balance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FundRow } from "./fund-row";
import { FundForm } from "./fund-form";

export default async function FundsPage() {
  await requireRole(["CHARITY_OFFICER"]);

  const funds = await prisma.fund.findMany({ orderBy: { name: "asc" } });
  const balances = await Promise.all(funds.map((fund) => getFundBalance(fund.id)));
  const balanceByFundId = new Map(balances.map((b) => [b.fundId, b.closingBalanceKobo]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Charity funds"
        description="Zakat, sadaqah, waqf, general and special appeals. A balance is always derived from payments in and disbursements out, never stored."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Funds</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {funds.map((fund) => (
            <FundRow key={fund.id} fund={fund} closingBalanceKobo={balanceByFundId.get(fund.id) ?? 0} />
          ))}
          {funds.length === 0 ? <EmptyState message="No funds yet." /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Add a fund</CardTitle>
        </CardHeader>
        <CardContent>
          <FundForm />
        </CardContent>
      </Card>
    </div>
  );
}
