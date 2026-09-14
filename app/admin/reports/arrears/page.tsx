import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { getArrearsReport } from "@/lib/reports/arrears";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default async function ArrearsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["FINANCE_OFFICER"]);
  const params = await searchParams;
  const wingId = typeof params.wingId === "string" ? params.wingId : "";

  const wings = await prisma.wing.findMany({ orderBy: { name: "asc" } });
  const rows = await getArrearsReport(wingId || undefined);
  const totalOutstandingKobo = rows.reduce((sum, row) => sum + row.outstandingKobo, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Arrears</h1>
        <p className="text-sm text-muted-foreground">
          Active members with an unpaid balance on at least one contribution record.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Wing</Label>
              <select
                name="wingId"
                defaultValue={wingId}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All wings</option>
                {wings.map((wing) => (
                  <option key={wing.id} value={wing.id}>
                    {wing.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} member{rows.length === 1 ? "" : "s"} in arrears &middot; total outstanding{" "}
          {formatNaira(totalOutstandingKobo)}
        </p>
        <Button
          variant="outline"
          render={
            <Link href={`/admin/reports/arrears/export${wingId ? `?wingId=${wingId}` : ""}`}>
              Export CSV
            </Link>
          }
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-2 font-medium">Member</th>
              <th className="p-2 font-medium">Member number</th>
              <th className="p-2 font-medium">Wing</th>
              <th className="p-2 font-medium">Unpaid periods</th>
              <th className="p-2 font-medium">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.memberId} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2">
                  <Link href={`/admin/members/${row.memberId}`} className="font-medium hover:underline">
                    {row.surname} {row.firstName}
                  </Link>
                </td>
                <td className="p-2 text-muted-foreground">{row.memberNumber ?? "Not yet issued"}</td>
                <td className="p-2">{row.wingName}</td>
                <td className="p-2">{row.recordCount}</td>
                <td className="p-2">{formatNaira(row.outstandingKobo)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  Nobody is in arrears.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
