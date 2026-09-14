import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReportsPage() {
  await requireRole(["FINANCE_OFFICER"]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Finance reports, all exportable to CSV.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Collections</CardTitle>
          <CardDescription>
            Confirmed payments, grouped by period, plan, wing, officer or method.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/admin/reports/collections">Open</Link>} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Arrears</CardTitle>
          <CardDescription>Active members with an unpaid balance, per wing.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/admin/reports/arrears">Open</Link>} />
        </CardContent>
      </Card>
    </div>
  );
}
