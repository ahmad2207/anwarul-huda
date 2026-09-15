import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusTag } from "@/components/status-tag";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { GatheringForm } from "./gathering-form";
import { CloseGatheringButton } from "./close-gathering-button";

const TYPE_LABELS: Record<string, string> = {
  JUMUAH: "Jumu'ah",
  TALEEM: "Ta'leem",
  WING_MEETING: "Wing meeting",
  GENERAL_MEETING: "General meeting",
  PROGRAMME: "Programme",
  OTHER: "Other",
};

export default async function AttendancePage() {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");

  const [gatherings, wings, branches] = await Promise.all([
    prisma.gathering.findMany({
      where: canSeeAll ? {} : { OR: [{ wingId: null }, { wingId: { in: user.wingIds } }] },
      include: { wing: true, branch: true, _count: { select: { records: true } } },
      orderBy: { startsAt: "desc" },
      take: 50,
    }),
    prisma.wing.findMany({ orderBy: { name: "asc" } }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  const columns: DataTableColumn<(typeof gatherings)[number]>[] = [
    {
      key: "gathering",
      header: "Gathering",
      cell: (gathering) => (
        <Link href={`/admin/attendance/${gathering.id}`} className="font-medium hover:underline">
          {gathering.title}
        </Link>
      ),
    },
    { key: "type", header: "Type", cell: (gathering) => TYPE_LABELS[gathering.type] ?? gathering.type },
    { key: "wing", header: "Wing", cell: (gathering) => gathering.wing?.name ?? "All wings" },
    { key: "starts", header: "Starts", cell: (gathering) => gathering.startsAt.toLocaleString("en-NG") },
    { key: "checkedIn", header: "Checked in", cell: (gathering) => gathering._count.records },
    {
      key: "status",
      header: "Status",
      cell: (gathering) => (gathering.isClosed ? <StatusTag tone="neutral">Closed</StatusTag> : null),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (gathering) => (!gathering.isClosed ? <CloseGatheringButton gatheringId={gathering.id} /> : null),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Attendance"
        description="Create a gathering, then run check-in against it. A closed gathering accepts no more check-ins."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">New gathering</CardTitle>
        </CardHeader>
        <CardContent>
          <GatheringForm wings={canSeeAll ? wings : wings.filter((w) => user.wingIds.includes(w.id))} branches={branches} />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={gatherings}
        rowKey={(gathering) => gathering.id}
        emptyMessage="No gatherings yet."
      />
    </div>
  );
}
