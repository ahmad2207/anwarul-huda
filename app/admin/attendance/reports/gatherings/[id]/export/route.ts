import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { toCsvDocument } from "@/lib/csv";
import { getGatheringAttendeeList } from "@/lib/attendance/reports";
import { withRouteAuth } from "@/lib/route-auth";

async function handleGet(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const { id } = await params;

  const gathering = await prisma.gathering.findUnique({ where: { id } });
  if (!gathering) {
    return new Response("That gathering could not be found.", { status: 404 });
  }

  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");
  if (!canSeeAll && (!gathering.wingId || !user.wingIds.includes(gathering.wingId))) {
    return new Response("That gathering could not be found.", { status: 404 });
  }

  const rows = await getGatheringAttendeeList(id);
  const csv = toCsvDocument(
    ["Name", "Membership number", "Checked in at"],
    rows.map((row) => [row.name, row.memberNumber ?? "Not yet issued", row.checkedInAt.toISOString()]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendees-${id}.csv"`,
    },
  });
}

export const GET = withRouteAuth(handleGet);
