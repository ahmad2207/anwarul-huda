import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFundBalance } from "@/lib/charity/fund-balance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FundRow } from "./fund-row";
import { FundForm } from "./fund-form";

export default async function FundsPage() {
  await requireRole(["CHARITY_OFFICER"]);

  const funds = await prisma.fund.findMany({ orderBy: { name: "asc" } });
  const balances = await Promise.all(funds.map((fund) => getFundBalance(fund.id)));
  const balanceByFundId = new Map(balances.map((b) => [b.fundId, b.closingBalanceKobo]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Charity funds</h1>
        <p className="text-sm text-muted-foreground">
          Zakat, sadaqah, waqf, general and special appeals. A balance is always derived from payments in
          and disbursements out, never stored.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Funds</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {funds.map((fund) => (
            <FundRow key={fund.id} fund={fund} closingBalanceKobo={balanceByFundId.get(fund.id) ?? 0} />
          ))}
          {funds.length === 0 ? <p className="text-sm text-muted-foreground">No funds yet.</p> : null}
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
