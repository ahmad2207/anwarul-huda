import { NextRequest } from "next/server";
import type { GatheringType } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { toCsvDocument } from "@/lib/csv";
import { getGatheringAttendanceReport, resolveWingFilter } from "@/lib/attendance/reports";
import type { WingScope } from "@/lib/attendance/reports";

const TYPE_LABELS: Record<string, string> = {
  JUMUAH: "Jumu'ah",
  TALEEM: "Ta'leem",
  WING_MEETING: "Wing meeting",
  GENERAL_MEETING: "General meeting",
  PROGRAMME: "Programme",
  OTHER: "Other",
};

export async function GET(request: NextRequest) {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");
  const scope: WingScope = canSeeAll ? null : user.wingIds;

  const params = request.nextUrl.searchParams;
  const from = params.get("from") ? new Date(params.get("from")!) : undefined;
  const to = params.get("to") ? new Date(params.get("to")!) : undefined;
  const type = (params.get("type") || undefined) as GatheringType | undefined;
  const wingId = resolveWingFilter(params.get("wingId") || undefined, scope);

  const rows = await getGatheringAttendanceReport({ from, to, type, wingId, scope });

  const csv = toCsvDocument(
    ["Gathering", "Type", "Wing", "Date", "Checked in", "Status"],
    rows.map((row) => [
      row.title,
      TYPE_LABELS[row.type] ?? row.type,
      row.wingName,
      row.startsAt.toISOString().slice(0, 10),
      String(row.checkedInCount),
      row.isClosed ? "Closed" : "Open",
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attendance-per-gathering.csv"',
    },
  });
}
