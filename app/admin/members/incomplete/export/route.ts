import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { toCsvDocument } from "@/lib/csv";
import { getMemberProgressReport, PROGRESS_STATUSES, PROGRESS_STATUS_LABELS } from "@/lib/members/progress-report";
import type { MemberProgressStatus } from "@/lib/members/progress-report";

const DEFAULT_STATUS: MemberProgressStatus = "NEVER_LOGGED_IN";

function isProgressStatus(value: string): value is MemberProgressStatus {
  return (PROGRESS_STATUSES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const user = await requireRole(["WING_ADMIN"]);
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");

  const statusParam = request.nextUrl.searchParams.get("status") ?? "";
  const status = isProgressStatus(statusParam) ? statusParam : DEFAULT_STATUS;

  const rows = (await getMemberProgressReport(isSuperAdmin ? null : user.wingIds)).filter(
    (row) => row.status === status,
  );

  const csv = toCsvDocument(
    ["Name", "Member number", "Wing", "Status", "Sections completed", "Next section", "Last login"],
    rows.map((row) => [
      row.displayName,
      row.memberNumber ?? "",
      row.wingName,
      PROGRESS_STATUS_LABELS[row.status],
      `${row.completedCount} of ${row.totalSections}`,
      row.nextSectionLabel ?? "",
      row.lastLoginAt ? row.lastLoginAt.toISOString() : "",
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="member-progress-${status.toLowerCase()}.csv"`,
    },
  });
}
