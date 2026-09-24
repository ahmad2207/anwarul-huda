import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatGatheringWhen } from "@/lib/members/member-home";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<string, string> = {
  JUMUAH: "Jumu'ah",
  TALEEM: "Ta'leem",
  WING_MEETING: "Wing meeting",
  GENERAL_MEETING: "General meeting",
  PROGRAMME: "Programme",
  OTHER: "Other",
};

// The member's own attendance record (MEMBER-INTERFACE.md 3.1), linked
// from the home screen. A plain list of where and when, newest first:
// no totals, percentages or streaks (MEMBER-HOME-AND-ADMIN-VIEW.md 1.3).
export default async function MyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user.memberId) {
    return <p className="text-base text-muted-foreground">This account is not linked to a member record.</p>;
  }

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const where: Prisma.AttendanceRecordWhereInput = {
    memberId: user.memberId,
    ...(q ? { gathering: { title: { contains: q, mode: "insensitive" } } } : {}),
  };

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      select: {
        id: true,
        checkedInAt: true,
        gathering: { select: { title: true, type: true, startsAt: true } },
      },
      orderBy: { checkedInAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(targetPage));
    return `/account/attendance?${next.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-navy-900">Your attendance</h1>

      <form method="get" className="flex items-end gap-2">
        <FormField label="Search by gathering" htmlFor="q" className="flex-1">
          <Input id="q" name="q" defaultValue={q} className="h-11 text-base" />
        </FormField>
        <Button type="submit" className="h-11 rounded-[4px] px-5 text-base">
          Search
        </Button>
      </form>

      {records.length === 0 ? (
        <p className="text-base text-muted-foreground">
          {q ? "No gatherings match that search." : "No attendance recorded yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {records.map((record) => (
            <li key={record.id} className="rounded-[4px] border border-border bg-card p-3">
              <p className="text-base font-medium">{record.gathering.title}</p>
              <p className="text-sm text-muted-foreground">
                {TYPE_LABELS[record.gathering.type] ?? record.gathering.type},{" "}
                {formatGatheringWhen(record.gathering.startsAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-base">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              className="h-11 rounded-[4px] px-4 text-base"
              render={<Link href={pageHref(Math.max(1, page - 1))}>Previous</Link>}
            />
            <Button
              variant="outline"
              disabled={page >= totalPages}
              className="h-11 rounded-[4px] px-4 text-base"
              render={<Link href={pageHref(Math.min(totalPages, page + 1))}>Next</Link>}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
