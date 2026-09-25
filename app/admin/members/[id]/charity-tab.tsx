import Link from "next/link";
import type { RoleName } from "@prisma/client";
import { getMemberCharityHistory, type MemberCharityCaseRow } from "@/lib/members/charity-history";
import { formatLagosDate } from "@/lib/timezone";
import { Money } from "@/components/money";
import { DataTable, type DataTableColumn } from "@/components/data-table";

// MEMBER-HOME-AND-ADMIN-VIEW.md 2.7. Rendered only for a viewer who
// passes canViewCharityHistory, and getMemberCharityHistory refuses
// anyone else in any case, so this data is never fetched for a wing
// admin, finance or attendance officer.
export async function CharityTab({ viewer, memberId }: { viewer: { roles: RoleName[] }; memberId: string }) {
  const cases = await getMemberCharityHistory(viewer, memberId);

  const columns: DataTableColumn<MemberCharityCaseRow>[] = [
    {
      key: "reference",
      header: "Case",
      cell: (row) => (
        <Link href={`/admin/charity/cases/${row.id}`} className="font-mono underline-offset-2 hover:underline">
          {row.reference}
        </Link>
      ),
    },
    { key: "opened", header: "Opened", cell: (row) => formatLagosDate(row.createdAt) },
    { key: "status", header: "Status", cell: (row) => row.status.charAt(0) + row.status.slice(1).toLowerCase() },
    { key: "requested", header: "Requested", align: "right", cell: (row) => <Money kobo={row.requestedKobo} /> },
    {
      key: "approved",
      header: "Approved",
      align: "right",
      cell: (row) => (row.approvedKobo === null ? "" : <Money kobo={row.approvedKobo} />),
    },
    { key: "disbursed", header: "Disbursed", align: "right", cell: (row) => <Money kobo={row.disbursedKobo} /> },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Visible to charity officers and super administrators only. Do not share outside the charity process.
      </p>
      <DataTable columns={columns} rows={cases} rowKey={(row) => row.id} emptyMessage="No charity cases are linked to this member." />
    </div>
  );
}
