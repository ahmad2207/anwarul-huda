import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status-tag";
import type { StatusTone } from "@/components/status-tag";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  VERIFIED: "Verified",
  RECOMMENDED: "Recommended",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DISBURSED: "Disbursed",
  CLOSED: "Closed",
};

// Recommended is awaiting a decision (attention), approved and
// disbursed are both a confirmed outcome, rejected is the one alert
// state. Draft, verified and closed are just where the case is in the
// workflow, not a state that needs a colour.
const STATUS_TONES: Record<string, StatusTone> = {
  RECOMMENDED: "attention",
  APPROVED: "confirmed",
  DISBURSED: "confirmed",
  REJECTED: "alert",
};

function caseStatusTone(status: string): StatusTone {
  return STATUS_TONES[status] ?? "neutral";
}

export default async function CharityCasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["CHARITY_OFFICER"]);
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";

  const cases = await prisma.charityCase.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Beneficiary cases</h1>
          <p className="text-sm text-muted-foreground">{cases.length} case{cases.length === 1 ? "" : "s"}</p>
        </div>
        <Button render={<Link href="/admin/charity/cases/new">New case</Link>} />
      </div>

      <form method="get" className="flex items-end gap-2">
        <select
          name="status"
          defaultValue={status}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
      </form>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b bg-muted text-left">
            <tr>
              <th className="p-2 font-medium">Reference</th>
              <th className="p-2 font-medium">Beneficiary</th>
              <th className="p-2 text-right font-medium">Requested</th>
              <th className="p-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((charityCase) => (
              <tr key={charityCase.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2 font-mono">
                  <Link
                    href={`/admin/charity/cases/${charityCase.id}`}
                    className="font-medium hover:underline"
                  >
                    {charityCase.reference}
                  </Link>
                </td>
                <td className="p-2">{charityCase.beneficiaryName}</td>
                <td className="p-2 text-right font-mono tabular-nums">{formatNaira(charityCase.requestedKobo)}</td>
                <td className="p-2">
                  <StatusTag tone={caseStatusTone(charityCase.status)}>
                    {STATUS_LABELS[charityCase.status] ?? charityCase.status}
                  </StatusTag>
                </td>
              </tr>
            ))}
            {cases.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                  No cases match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
