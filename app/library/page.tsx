import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChevronDown, Search } from "lucide-react";
import { PageTitle, memberLinkCardClass } from "@/components/member/card";
import { Field, SelectField, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/member/form";
import { Pager } from "@/components/member/pager";
import { formatLagosDate, parseLagosDayEnd, parseLagosDayStart } from "@/lib/timezone";

const PAGE_SIZE = 20;

const CONTENT_TYPES = ["SERMON", "WEEKLY_BOOK", "ARTICLE", "ANNOUNCEMENT"] as const;
const TYPE_LABELS: Record<string, string> = {
  SERMON: "Sermon",
  WEEKLY_BOOK: "Weekly book",
  ARTICLE: "Article",
  ANNOUNCEMENT: "Announcement",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();

  if (!user.memberId) {
    return (
      <p className="text-base text-ink-2">This account is not linked to a member record.</p>
    );
  }

  const member = await prisma.member.findUnique({ where: { id: user.memberId }, select: { wingId: true } });
  const memberWingId = member?.wingId ?? null;

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const typeParam = typeof params.type === "string" ? params.type : "";
  const speaker = typeof params.speaker === "string" ? params.speaker.trim() : "";
  const tag = typeof params.tag === "string" ? params.tag.trim().toLowerCase() : "";
  const from = parseLagosDayStart(params.from);
  const to = parseLagosDayEnd(params.to);
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const and: Prisma.ContentItemWhereInput[] = [
    // Only what this member is actually allowed to see: published, past
    // its publish time if it has one, and either open to all wings or
    // matching this member's own wing. Applied here at the database
    // level, unconditionally, regardless of what filters were requested.
    { isPublished: true },
    { OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
    { OR: [{ wingId: null }, { wingId: memberWingId ?? "__none__" }] },
  ];
  if (q) {
    and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }] });
  }
  if ((CONTENT_TYPES as readonly string[]).includes(typeParam)) {
    and.push({ type: typeParam as (typeof CONTENT_TYPES)[number] });
  }
  if (speaker) {
    and.push({ author: { contains: speaker, mode: "insensitive" } });
  }
  if (tag) {
    and.push({ tags: { has: tag } });
  }
  if (from || to) {
    and.push({ deliveredOn: { gte: from, lte: to } });
  }

  const where: Prisma.ContentItemWhereInput = { AND: and };

  const [items, total] = await Promise.all([
    prisma.contentItem.findMany({
      where,
      select: {
        id: true,
        slug: true,
        type: true,
        title: true,
        author: true,
        summary: true,
        tags: true,
        deliveredOn: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.contentItem.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (typeParam) next.set("type", typeParam);
    if (speaker) next.set("speaker", speaker);
    if (tag) next.set("tag", tag);
    if (params.from && typeof params.from === "string") next.set("from", params.from);
    if (params.to && typeof params.to === "string") next.set("to", params.to);
    next.set("page", String(targetPage));
    return `/library?${next.toString()}`;
  }

  const fromParam = typeof params.from === "string" ? params.from : "";
  const toParam = typeof params.to === "string" ? params.to : "";
  const moreFiltersActive = Boolean(typeParam || speaker || tag || fromParam || toParam);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle lead="Sermons, the weekly book and articles from the league.">Books</PageTitle>

      <form method="get" role="search" className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="library-q" className="text-base font-medium">
              Search by title or summary
            </label>
            <input id="library-q" name="q" type="search" defaultValue={q} className={inputClass} />
          </div>
          <button type="submit" className={primaryButtonClass}>
            <Search className="size-5" aria-hidden="true" />
            Search
          </button>
        </div>

        <details open={moreFiltersActive} className="group rounded-[14px] bg-card shadow-warm">
          <summary className="flex min-h-11 cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden justify-between gap-2 rounded-[14px] px-4 text-base font-medium text-navy-900">
            More filters
            <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
            <SelectField
              label="Type"
              id="type"
              placeholder="All types"
              defaultValue={typeParam}
              options={CONTENT_TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] }))}
            />
            <Field label="Speaker or author" id="speaker" defaultValue={speaker} />
            <Field label="Tag" id="tag" defaultValue={tag} />
            <div className="hidden sm:block" />
            <Field label="From" id="from" type="date" defaultValue={fromParam} />
            <Field label="To" id="to" type="date" defaultValue={toParam} />
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" className={primaryButtonClass}>
                Apply filters
              </button>
              {moreFiltersActive || q ? (
                <Link href="/library" className={secondaryButtonClass}>
                  Clear all
                </Link>
              ) : null}
            </div>
          </div>
        </details>
      </form>

      {/* Text only, no cover images here: keeps this list light on a slow connection. Covers show on the item's own page. */}
      {items.length === 0 ? (
        <p className="text-base text-ink-2">
          {q || moreFiltersActive ? "Nothing matches this search. Try fewer words, or clear the filters." : "Nothing has been shared yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/library/${item.slug}`} className={`${memberLinkCardClass} gap-1`}>
                <span className="text-sm font-medium text-navy-700">{TYPE_LABELS[item.type] ?? item.type}</span>
                <span className="font-heading text-lg font-semibold text-navy-900">{item.title}</span>
                <span className="text-base text-ink-2">
                  {item.author ?? "Unknown"}
                  {item.deliveredOn ? `, ${formatLagosDate(item.deliveredOn)}` : ""}
                </span>
                {item.summary ? <span className="line-clamp-3 text-base text-ink">{item.summary}</span> : null}
                {item.tags.length > 0 ? <span className="text-sm text-ink-2">{item.tags.join(", ")}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pager page={page} totalPages={totalPages} hrefFor={pageHref} />
    </div>
  );
}
