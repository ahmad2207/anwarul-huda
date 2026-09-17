import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getMemberAttendanceHistory } from "@/lib/attendance/reports";
import type { MemberAttendanceRow } from "@/lib/attendance/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { MemberNumber } from "@/components/member-number";
import { formatMemberName } from "@/lib/members/display-name";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { loadReportMember } from "./actions";
import { MemberPicker } from "./member-picker";

const TYPE_LABELS: Record<string, string> = {
  JUMUAH: "Jumu'ah",
  TALEEM: "Ta'leem",
  WING_MEETING: "Wing meeting",
  GENERAL_MEETING: "General meeting",
  PROGRAMME: "Programme",
  OTHER: "Other",
};

export default async function MemberAttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const params = await searchParams;

  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const memberId = typeof params.memberId === "string" ? params.memberId : "";

  const member = memberId ? await loadReportMember(memberId) : null;
  const rows = member
    ? await getMemberAttendanceHistory(member.id, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      })
    : [];

  const exportParams = new URLSearchParams();
  if (member) exportParams.set("memberId", member.id);
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);

  const columns: DataTableColumn<MemberAttendanceRow>[] = [
    {
      key: "gathering",
      header: "Gathering",
      cell: (row) => (
        <Link href={`/admin/attendance/${row.gatheringId}`} className="font-medium hover:underline">
          {row.title}
        </Link>
      ),
    },
    { key: "type", header: "Type", cell: (row) => TYPE_LABELS[row.type] ?? row.type },
    { key: "wing", header: "Wing", cell: (row) => row.wingName },
    { key: "checkedInAt", header: "Checked in at", cell: (row) => row.checkedInAt.toLocaleString("en-NG") },
    { key: "method", header: "Method", cell: (row) => (row.method === "QR_CODE" ? "QR code" : "Manual") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Attendance per member" description="Every gathering a member checked in to over a period." />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <FormField label="Member: name, phone or number">
            <MemberPicker from={from} to={to} />
            {member ? (
              <p className="text-sm">
                Showing: <span className="font-medium">{formatMemberName(member)}</span>{" "}
                <span className="text-muted-foreground">
                  (<MemberNumber value={member.memberNumber} /> &middot; {member.wingName})
                </span>
              </p>
            ) : memberId ? (
              <p className="text-sm text-destructive">That member could not be found, or is not in a wing you can view.</p>
            ) : null}
          </FormField>

          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="memberId" value={memberId} />
            <FormField label="From" htmlFor="from">
              <Input id="from" type="date" name="from" defaultValue={from} />
            </FormField>
            <FormField label="To" htmlFor="to">
              <Input id="to" type="date" name="to" defaultValue={to} />
            </FormField>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      {member ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {rows.length} gathering{rows.length === 1 ? "" : "s"} attended
            </p>
            <Button
              variant="outline"
              render={<Link href={`/admin/attendance/reports/member/export?${exportParams.toString()}`}>Export CSV</Link>}
            />
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.gatheringId}
            emptyMessage="No attendance recorded for this member in this period."
          />
        </>
      ) : null}
    </div>
  );
}
