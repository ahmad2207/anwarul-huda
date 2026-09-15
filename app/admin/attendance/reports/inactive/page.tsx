import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getMembersNotAttendedSince, resolveWingFilter } from "@/lib/attendance/reports";
import type { WingScope } from "@/lib/attendance/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PAGE_SIZE = 20;
const DEFAULT_WEEKS = 4;

export default async function InactiveMembersReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const canSeeAll = canViewAllWings(user) || user.roles.includes("ATTENDANCE_OFFICER");
  const scope: WingScope = canSeeAll ? null : user.wingIds;

  const params = await searchParams;
  const weeks = Math.max(1, Number(typeof params.weeks === "string" ? params.weeks : String(DEFAULT_WEEKS)) || DEFAULT_WEEKS);
  const requestedWingId = typeof params.wingId === "string" ? params.wingId : undefined;
  const wingId = resolveWingFilter(requestedWingId, scope);
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

  const wings = await prisma.wing.findMany({
    where: scope ? { id: { in: scope } } : {},
    orderBy: { name: "asc" },
  });

  const { rows, total } = await getMembersNotAttendedSince({ cutoff, scope, wingId, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    next.set("weeks", String(weeks));
    if (wingId) next.set("wingId", wingId);
    next.set("page", String(targetPage));
    return `/admin/attendance/reports/inactive?${next.toString()}`;
  }

  const exportParams = new URLSearchParams();
  exportParams.set("weeks", String(weeks));
  if (wingId) exportParams.set("wingId", wingId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Not attended recently</h1>
        <p className="text-sm text-muted-foreground">
          Active members who have not attended anything in the given number of weeks, including those who
          have never attended.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Weeks</Label>
              <Input type="number" name="weeks" min={1} defaultValue={weeks} className="w-24" />
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
          {total} member{total === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          render={<Link href={`/admin/attendance/reports/inactive/export?${exportParams.toString()}`}>Export CSV</Link>}
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-2 font-medium">Member</th>
              <th className="p-2 font-medium">Member number</th>
              <th className="p-2 font-medium">Wing</th>
              <th className="p-2 font-medium">Last attended</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.memberId} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2">
                  <Link href={`/admin/members/${row.memberId}`} className="font-medium hover:underline">
                    {row.surname} {row.firstName}
                  </Link>
                </td>
                <td className="p-2 text-muted-foreground">{row.memberNumber ?? "Not yet issued"}</td>
                <td className="p-2">{row.wingName}</td>
                <td className="p-2">{row.lastAttendedAt ? row.lastAttendedAt.toLocaleDateString("en-NG") : "Never"}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                  Everyone in view has attended within the given period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              render={<Link href={pageHref(Math.max(1, page - 1))}>Previous</Link>}
            />
            <Button
              variant="outline"
              disabled={page >= totalPages}
              render={<Link href={pageHref(Math.min(totalPages, page + 1))}>Next</Link>}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
