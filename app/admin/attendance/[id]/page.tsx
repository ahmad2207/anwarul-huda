import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">{gathering.title}</h1>
        <p className="text-sm text-muted-foreground">{gathering.wing?.name ?? "All wings"}</p>
      </div>
      <CheckInClient
        gatheringId={gathering.id}
        initialCount={gathering._count.records}
        isClosed={gathering.isClosed}
      />
    </div>
  );
}
