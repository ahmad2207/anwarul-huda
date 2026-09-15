import Link from "next/link";
import type { CharityCase } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { Money } from "@/components/money";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
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

  const columns: DataTableColumn<CharityCase>[] = [
    {
      key: "reference",
      header: "Reference",
      cell: (charityCase) => (
        <Link href={`/admin/charity/cases/${charityCase.id}`} className="font-mono font-medium hover:underline">
          {charityCase.reference}
        </Link>
      ),
    },
    { key: "beneficiary", header: "Beneficiary", cell: (charityCase) => charityCase.beneficiaryName },
    {
      key: "requested",
      header: "Requested",
      align: "right",
      cell: (charityCase) => <Money kobo={charityCase.requestedKobo} />,
    },
    {
      key: "status",
      header: "Status",
      cell: (charityCase) => (
        <StatusTag tone={caseStatusTone(charityCase.status)}>
          {STATUS_LABELS[charityCase.status] ?? charityCase.status}
        </StatusTag>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Beneficiary cases"
        description={`${cases.length} case${cases.length === 1 ? "" : "s"}`}
        actions={<Button render={<Link href="/admin/charity/cases/new">New case</Link>} />}
      />

      <form method="get" className="flex items-end gap-2">
        <FormField label="Status" htmlFor="status">
          <select
            id="status"
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
        </FormField>
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
      </form>

      <DataTable
        columns={columns}
        rows={cases}
        rowKey={(charityCase) => charityCase.id}
        emptyMessage="No cases match this filter."
      />
    </div>
  );
}
