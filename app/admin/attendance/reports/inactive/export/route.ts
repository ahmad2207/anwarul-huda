import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { toCsvDocument } from "@/lib/csv";
import { getMembersNotAttendedSince, resolveWingFilter } from "@/lib/attendance/reports";
import type { WingScope } from "@/lib/attendance/reports";
import { withRouteAuth } from "@/lib/route-auth";
import { toLagosDateInputValue } from "@/lib/timezone";

const DEFAULT_WEEKS = 4;
const EXPORT_LIMIT = 10000; // matches the "assume ten thousand members" ceiling used elsewhere

async function handleGet(request: NextRequest) {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");
  const scope: WingScope = canSeeAll ? null : user.wingIds;

  const params = request.nextUrl.searchParams;
  const weeks = Math.max(1, Number(params.get("weeks") || String(DEFAULT_WEEKS)) || DEFAULT_WEEKS);
  const wingId = resolveWingFilter(params.get("wingId") || undefined, scope);
  const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

  const { rows } = await getMembersNotAttendedSince({ cutoff, scope, wingId, page: 1, pageSize: EXPORT_LIMIT });

  const csv = toCsvDocument(
    ["Member", "Member number", "Wing", "Last attended"],
    rows.map((row) => [
      `${row.surname} ${row.firstName}`,
      row.memberNumber ?? "",
      row.wingName,
      row.lastAttendedAt ? toLagosDateInputValue(row.lastAttendedAt) : "Never",
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="not-attended-recently.csv"',
    },
  });
}

export const GET = withRouteAuth(handleGet);
