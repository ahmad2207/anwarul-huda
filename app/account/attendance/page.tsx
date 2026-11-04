import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatGatheringWhen } from "@/lib/members/member-home";
import { Search } from "lucide-react";
import { PageTitle, memberCardClass } from "@/components/member/card";
import { inputClass, primaryButtonClass } from "@/components/member/form";
import { Pager } from "@/components/member/pager";

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
    return <p className="text-base text-ink-2">This account is not linked to a member record.</p>;
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
    <div className="flex flex-col gap-6">
      <PageTitle lead="Every gathering you have been checked in at, newest first.">Your attendance</PageTitle>

      <form method="get" role="search" className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-base font-medium">
            Search by gathering
          </label>
          <input id="q" name="q" type="search" defaultValue={q} className={inputClass} />
        </div>
        <button type="submit" className={primaryButtonClass}>
          <Search className="size-5" aria-hidden="true" />
          Search
        </button>
      </form>

      {records.length === 0 ? (
        <p className="text-base text-ink-2">
          {q ? "No gatherings match that search." : "No attendance recorded yet."}
        </p>
      ) : (
        <ul className={`${memberCardClass} divide-y divide-border overflow-hidden`}>
          {records.map((record) => (
            <li key={record.id} className="p-4">
              <p className="text-base font-semibold">{record.gathering.title}</p>
              <p className="text-base text-ink-2">
                {TYPE_LABELS[record.gathering.type] ?? record.gathering.type},{" "}
                {formatGatheringWhen(record.gathering.startsAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Pager page={page} totalPages={totalPages} hrefFor={pageHref} />
    </div>
  );
}
