import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusTag } from "@/components/status-tag";
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Create a gathering, then run check-in against it. A closed gathering accepts no more
          check-ins.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">New gathering</CardTitle>
        </CardHeader>
        <CardContent>
          <GatheringForm wings={canSeeAll ? wings : wings.filter((w) => user.wingIds.includes(w.id))} branches={branches} />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b bg-muted text-left">
            <tr>
              <th className="p-2 font-medium">Gathering</th>
              <th className="p-2 font-medium">Type</th>
              <th className="p-2 font-medium">Wing</th>
              <th className="p-2 font-medium">Starts</th>
              <th className="p-2 font-medium">Checked in</th>
              <th className="p-2 font-medium">Status</th>
              <th className="p-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {gatherings.map((gathering) => (
              <tr key={gathering.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2">
                  <Link href={`/admin/attendance/${gathering.id}`} className="font-medium hover:underline">
                    {gathering.title}
                  </Link>
                </td>
                <td className="p-2">{TYPE_LABELS[gathering.type] ?? gathering.type}</td>
                <td className="p-2">{gathering.wing?.name ?? "All wings"}</td>
                <td className="p-2">{gathering.startsAt.toLocaleString("en-NG")}</td>
                <td className="p-2">{gathering._count.records}</td>
                <td className="p-2">
                  {gathering.isClosed ? <StatusTag tone="neutral">Closed</StatusTag> : null}
                </td>
                <td className="p-2">
                  {!gathering.isClosed ? <CloseGatheringButton gatheringId={gathering.id} /> : null}
                </td>
              </tr>
            ))}
            {gatherings.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  No gatherings yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
