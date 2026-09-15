import Link from "next/link";
import type { GatheringType } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getGatheringAttendanceReport, resolveWingFilter } from "@/lib/attendance/reports";
import type { WingScope } from "@/lib/attendance/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusTag } from "@/components/status-tag";

const TYPE_LABELS: Record<string, string> = {
  JUMUAH: "Jumu'ah",
  TALEEM: "Ta'leem",
  WING_MEETING: "Wing meeting",
  GENERAL_MEETING: "General meeting",
  PROGRAMME: "Programme",
  OTHER: "Other",
};

export default async function GatheringAttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");
  const scope: WingScope = canSeeAll ? null : user.wingIds;

  const params = await searchParams;
  const from = typeof params.from === "string" && params.from ? new Date(params.from) : undefined;
  const to = typeof params.to === "string" && params.to ? new Date(params.to) : undefined;
  const type = typeof params.type === "string" && params.type ? (params.type as GatheringType) : undefined;
  const requestedWingId = typeof params.wingId === "string" ? params.wingId : undefined;
  const wingId = resolveWingFilter(requestedWingId, scope);

  const wings = await prisma.wing.findMany({
    where: scope ? { id: { in: scope } } : {},
    orderBy: { name: "asc" },
  });

  const rows = await getGatheringAttendanceReport({ from, to, type, wingId, scope });
  const totalCheckIns = rows.reduce((sum, row) => sum + row.checkedInCount, 0);

  const exportParams = new URLSearchParams();
  if (params.from && typeof params.from === "string") exportParams.set("from", params.from);
  if (params.to && typeof params.to === "string") exportParams.set("to", params.to);
  if (type) exportParams.set("type", type);
  if (wingId) exportParams.set("wingId", wingId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Attendance per gathering</h1>
        <p className="text-sm text-muted-foreground">How many members checked in to each gathering.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">From</Label>
              <Input type="date" name="from" defaultValue={typeof params.from === "string" ? params.from : ""} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">To</Label>
              <Input type="date" name="to" defaultValue={typeof params.to === "string" ? params.to : ""} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Type</Label>
              <select
                name="type"
                defaultValue={type ?? ""}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All types</option>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {wings.length > 1 ? (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Wing</Label>
                <select
                  name="wingId"
                  defaultValue={wingId ?? ""}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">All wings</option>
                  {wings.map((wing) => (
                    <option key={wing.id} value={wing.id}>
                      {wing.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} gathering{rows.length === 1 ? "" : "s"} &middot; {totalCheckIns} total check-in
          {totalCheckIns === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          render={<Link href={`/admin/attendance/reports/gatherings/export?${exportParams.toString()}`}>Export CSV</Link>}
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-2 font-medium">Gathering</th>
              <th className="p-2 font-medium">Type</th>
              <th className="p-2 font-medium">Wing</th>
              <th className="p-2 font-medium">Date</th>
              <th className="p-2 font-medium">Checked in</th>
              <th className="p-2 font-medium">Status</th>
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
                <td className="p-2">{row.startsAt.toLocaleDateString("en-NG")}</td>
                <td className="p-2">{row.checkedInCount}</td>
                <td className="p-2">
                  <StatusTag tone="neutral">{row.isClosed ? "Closed" : "Open"}</StatusTag>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  No gatherings match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
