import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getMemberAttendanceHistory } from "@/lib/attendance/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Attendance per member</h1>
        <p className="text-sm text-muted-foreground">Every gathering a member checked in to over a period.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Member: name, phone or number</Label>
            <MemberPicker from={from} to={to} />
            {member ? (
              <p className="text-sm">
                Showing: <span className="font-medium">{member.surname} {member.firstName}</span>{" "}
                <span className="text-muted-foreground">
                  ({member.memberNumber ?? "Not yet issued"} &middot; {member.wingName})
                </span>
              </p>
            ) : memberId ? (
              <p className="text-sm text-destructive">That member could not be found, or is not in a wing you can view.</p>
            ) : null}
          </div>

          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="memberId" value={memberId} />
            <div className="flex flex-col gap-1">
              <Label className="text-xs">From</Label>
              <Input type="date" name="from" defaultValue={from} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">To</Label>
              <Input type="date" name="to" defaultValue={to} />
            </div>
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

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="p-2 font-medium">Gathering</th>
                  <th className="p-2 font-medium">Type</th>
                  <th className="p-2 font-medium">Wing</th>
                  <th className="p-2 font-medium">Checked in at</th>
                  <th className="p-2 font-medium">Method</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.gatheringId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-2">
                      <Link href={`/admin/attendance/${row.gatheringId}`} className="font-medium hover:underline">
                        {row.title}
                      </Link>
                    </td>
                    <td className="p-2">{TYPE_LABELS[row.type] ?? row.type}</td>
                    <td className="p-2">{row.wingName}</td>
                    <td className="p-2">{row.checkedInAt.toLocaleString("en-NG")}</td>
                    <td className="p-2">{row.method === "QR_CODE" ? "QR code" : "Manual"}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      No attendance recorded for this member in this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
