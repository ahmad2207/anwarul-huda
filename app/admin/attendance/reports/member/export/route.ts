import { NextRequest } from "next/server";
import { toCsvDocument } from "@/lib/csv";
import { getMemberAttendanceHistory } from "@/lib/attendance/reports";
import { loadReportMember } from "../actions";

const TYPE_LABELS: Record<string, string> = {
  JUMUAH: "Jumu'ah",
  TALEEM: "Ta'leem",
  WING_MEETING: "Wing meeting",
  GENERAL_MEETING: "General meeting",
  PROGRAMME: "Programme",
  OTHER: "Other",
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const memberId = params.get("memberId");
  if (!memberId) {
    return new Response("A member must be selected first.", { status: 400 });
  }

  // Re-checks role and wing scope: a wing admin cannot export another
  // wing's member by constructing this URL directly.
  const member = await loadReportMember(memberId);
  if (!member) {
    return new Response("That member could not be found, or is not in a wing you can view.", { status: 404 });
  }

  const from = params.get("from") ? new Date(params.get("from")!) : undefined;
  const to = params.get("to") ? new Date(params.get("to")!) : undefined;
  const rows = await getMemberAttendanceHistory(member.id, { from, to });

  const csv = toCsvDocument(
    ["Gathering", "Type", "Wing", "Checked in at", "Method"],
    rows.map((row) => [
      row.title,
      TYPE_LABELS[row.type] ?? row.type,
      row.wingName,
      row.checkedInAt.toISOString(),
      row.method === "QR_CODE" ? "QR code" : "Manual",
    ]),
  );

  // The member's name goes into a filename, not the header value directly,
  // and is stripped down to safe characters first: a name is free text
  // and must never end up dictating header syntax.
  const safeName = `${member.surname}-${member.firstName}`.replace(/[^a-zA-Z0-9-]+/g, "");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${safeName || "member"}.csv"`,
    },
  });
}
