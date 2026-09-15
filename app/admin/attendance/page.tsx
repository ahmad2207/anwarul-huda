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

      <div className="flex flex-col gap-2">
        {gatherings.map((gathering) => (
          <div key={gathering.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
            <div>
              <Link href={`/admin/attendance/${gathering.id}`} className="font-medium hover:underline">
                {gathering.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {TYPE_LABELS[gathering.type] ?? gathering.type} &middot;{" "}
                {gathering.wing?.name ?? "All wings"} &middot;{" "}
                {gathering.startsAt.toLocaleString("en-NG")} &middot; {gathering._count.records} checked in
                {gathering.isClosed ? (
                  <>
                    {" "}
                    &middot; <StatusTag tone="neutral">Closed</StatusTag>
                  </>
                ) : null}
              </p>
            </div>
            {!gathering.isClosed ? <CloseGatheringButton gatheringId={gathering.id} /> : null}
          </div>
        ))}
        {gatherings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No gatherings yet.</p>
        ) : null}
      </div>
    </div>
  );
}
