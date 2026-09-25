import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { toCsvDocument } from "@/lib/csv";
import { getWingAttendanceRates } from "@/lib/attendance/reports";
import type { WingScope } from "@/lib/attendance/reports";
import { withRouteAuth } from "@/lib/route-auth";
import { parseLagosDayEnd, parseLagosDayStart } from "@/lib/timezone";

async function handleGet(request: NextRequest) {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");
  const scope: WingScope = canSeeAll ? null : user.wingIds;

  const params = request.nextUrl.searchParams;
  const from = parseLagosDayStart(params.get("from"));
  const to = parseLagosDayEnd(params.get("to"));

  const rows = await getWingAttendanceRates({ from, to, scope });

  const csv = toCsvDocument(
    ["Wing", "Gatherings held", "Total check-ins", "Active members", "Rate (%)"],
    rows.map((row) => [
      row.wingName,
      String(row.gatheringsHeld),
      String(row.totalCheckIns),
      String(row.activeMemberCount),
      row.ratePercent.toFixed(1),
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attendance-rate-per-wing.csv"',
    },
  });
}

export const GET = withRouteAuth(handleGet);
