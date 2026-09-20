import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getGatheringAttendeeList } from "@/lib/attendance/reports";
import type { GatheringAttendeeRow } from "@/lib/attendance/reports";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";

export default async function GatheringAttendeeListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const { id } = await params;

  const gathering = await prisma.gathering.findUnique({ where: { id }, include: { wing: true } });
  if (!gathering) {
    notFound();
  }

  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");
  if (!canSeeAll && (!gathering.wingId || !user.wingIds.includes(gathering.wingId))) {
    notFound();
  }

  const rows = await getGatheringAttendeeList(id);

  const columns: DataTableColumn<GatheringAttendeeRow>[] = [
    { key: "name", header: "Name", cell: (row) => row.name },
    { key: "memberNumber", header: "Membership number", cell: (row) => row.memberNumber ?? "Not yet issued" },
    { key: "checkedInAt", header: "Checked in at", cell: (row) => row.checkedInAt.toLocaleString("en-NG") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/admin/attendance/reports/gatherings" label="Back to attendance per gathering" />
      <PageHeader
        title={`Attendees: ${gathering.title}`}
        description={`${gathering.wing?.name ?? "All wings"} · ${gathering.startsAt.toLocaleDateString("en-NG")}`}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} attendee{rows.length === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          render={<Link href={`/admin/attendance/reports/gatherings/${id}/export`}>Export CSV</Link>}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.memberId}
        emptyMessage="No one has checked in to this gathering yet."
      />
    </div>
  );
}
