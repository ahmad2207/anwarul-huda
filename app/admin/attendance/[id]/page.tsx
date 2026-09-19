import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/back-link";
import { CheckInClient } from "./check-in-client";

export default async function GatheringCheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const { id } = await params;

  const gathering = await prisma.gathering.findUnique({
    where: { id },
    include: { wing: true, _count: { select: { records: true } } },
  });

  if (!gathering) {
    notFound();
  }

  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");
  if (!canSeeAll && (!gathering.wingId || !user.wingIds.includes(gathering.wingId))) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-2">
      <BackLink href="/admin/attendance" label="Back to gatherings" />
      <CheckInClient
        gatheringId={gathering.id}
        gatheringTitle={gathering.title}
        wingName={gathering.wing?.name ?? "All wings"}
        initialCount={gathering._count.records}
        isClosed={gathering.isClosed}
      />
    </div>
  );
}
