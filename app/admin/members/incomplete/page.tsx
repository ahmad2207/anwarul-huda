import Link from "next/link";
import type { Member, Wing } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMemberName } from "@/lib/members/display-name";
import { PageHeader } from "@/components/page-header";
import { StatusTag } from "@/components/status-tag";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { CompleteRecordForm } from "./complete-record-form";

type IncompleteRow = Member & { wing: Wing };

export default async function IncompleteRecordsPage() {
  const user = await requireRole(["WING_ADMIN"]);
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");

  const members = await prisma.member.findMany({
    where: {
      isRecordIncomplete: true,
      ...(isSuperAdmin ? {} : { wingId: { in: user.wingIds } }),
    },
    include: { wing: true },
    orderBy: { createdAt: "asc" },
  });

  const columns: DataTableColumn<IncompleteRow>[] = [
    {
      key: "name",
      header: "Name as written",
      cell: (member) => <span className="font-medium">{formatMemberName(member)}</span>,
    },
    { key: "wing", header: "Wing", cell: (member) => member.wing.name },
    { key: "memberNumber", header: "Member number", cell: (member) => member.memberNumber ?? "Not yet issued" },
    {
      key: "missing",
      header: "Missing",
      cell: (member) => (
        <div className="flex flex-wrap gap-1">
          {!member.surname || !member.firstName ? <StatusTag tone="attention">Name not split</StatusTag> : null}
          {!member.phone ? <StatusTag tone="attention">Phone</StatusTag> : null}
        </div>
      ),
    },
    {
      key: "notes",
      header: "Review flag",
      cell: (member) => (
        <p className="max-w-sm text-xs text-muted-foreground">{member.notes ?? "No flag recorded."}</p>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (member) => <CompleteRecordForm memberId={member.id} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Incomplete records"
        description={`${members.length} record${members.length === 1 ? "" : "s"} waiting on a surname, first name or phone number`}
        actions={
          <Button variant="outline" size="sm" render={<Link href="/admin/members/bulk-issue-login">Bulk issue logins</Link>} />
        }
      />

      <DataTable
        columns={columns}
        rows={members}
        rowKey={(member) => member.id}
        emptyMessage="Nothing waiting to be completed."
        alignRowsTop
      />
    </div>
  );
}
