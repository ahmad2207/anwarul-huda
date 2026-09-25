import { NextRequest } from "next/server";
import { toCsvDocument } from "@/lib/csv";
import { getAttendanceLog } from "@/lib/members/member-view";
import { formatLagosDateTime, formatLagosDate } from "@/lib/timezone";
import { loadViewableMember } from "../../load-member";
import { parseAttendanceFilter } from "../../attendance-filter";
import { CHECK_IN_METHOD_LABELS, GATHERING_TYPE_LABELS } from "../../labels";

// The attendance log on the member view, as a CSV, for the same period
// and type filter the tab shows. Goes through the same loader as the
// page, so role and wing scope are checked before anything is read.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadViewableMember(id);
  if (!loaded) {
    return new Response("That member could not be found, or is not in a wing you can view.", { status: 404 });
  }
  const { member } = loaded;

  const search = request.nextUrl.searchParams;
  const filter = parseAttendanceFilter({
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    type: search.get("type") ?? undefined,
  });
  const { rows } = await getAttendanceLog(member.id, filter, null);

  const csv = toCsvDocument(
    ["Gathering", "Type", "Date", "Checked in (Lagos time)", "Method", "Recorded by"],
    rows.map((row) => [
      row.gatheringTitle,
      GATHERING_TYPE_LABELS[row.gatheringType],
      formatLagosDate(row.gatheringStartsAt),
      formatLagosDateTime(row.checkedInAt),
      CHECK_IN_METHOD_LABELS[row.method],
      row.recordedBy ?? "",
    ]),
  );

  // Built from the member number, never from free-text name fields, so
  // nothing a user typed can shape the header.
  const safeNumber = (member.memberNumber ?? member.id).replace(/[^a-zA-Z0-9-]+/g, "-");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${safeNumber}-${filter.fromValue}-to-${filter.toValue}.csv"`,
    },
  });
}
