import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
      <p className="text-base text-muted-foreground">This account is not linked to a member record.</p>
    );
  }

  const member = await prisma.member.findUnique({ where: { id: user.memberId }, select: { wingId: true } });
  const memberWingId = member?.wingId ?? null;

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const typeParam = typeof params.type === "string" ? params.type : "";
  const speaker = typeof params.speaker === "string" ? params.speaker.trim() : "";
  const tag = typeof params.tag === "string" ? params.tag.trim().toLowerCase() : "";
  const from = typeof params.from === "string" && params.from ? new Date(params.from) : undefined;
  const to = typeof params.to === "string" && params.to ? new Date(params.to) : undefined;
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Library</h1>
        <p className="text-base text-muted-foreground">Sermons, weekly books and articles.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              <Label className="text-sm">Search</Label>
              <Input name="q" defaultValue={q} placeholder="Title or summary..." className="h-11 text-base" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Type</Label>
              <select
                name="type"
                defaultValue={typeParam}
                className="h-11 rounded-md border border-input bg-background px-2 text-base"
              >
                <option value="">All types</option>
                {CONTENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Speaker or author</Label>
              <Input name="speaker" defaultValue={speaker} className="h-11 text-base" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Tag</Label>
              <Input name="tag" defaultValue={tag} className="h-11 text-base" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">From</Label>
              <Input
                type="date"
                name="from"
                defaultValue={typeof params.from === "string" ? params.from : ""}
                className="h-11 text-base"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">To</Label>
              <Input
                type="date"
                name="to"
                defaultValue={typeof params.to === "string" ? params.to : ""}
                className="h-11 text-base"
              />
            </div>
            <Button type="submit" className="h-11 px-5 text-base">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Text only, no cover images here: keeps this list light on a slow connection. Covers show on the item's own page. */}
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/library/${item.slug}`}
            className="flex min-h-11 flex-col gap-1 rounded-md border p-4 text-base hover:bg-muted/30"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{item.title}</span>
              <span className="text-sm text-muted-foreground">{TYPE_LABELS[item.type] ?? item.type}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {item.author ?? "Unknown"}
              {item.deliveredOn ? ` · ${item.deliveredOn.toLocaleDateString("en-NG")}` : ""}
            </p>
            {item.summary ? <p className="text-muted-foreground">{item.summary}</p> : null}
            {item.tags.length > 0 ? (
              <p className="text-sm text-muted-foreground">{item.tags.join(", ")}</p>
            ) : null}
          </Link>
        ))}
        {items.length === 0 ? (
          <p className="text-base text-muted-foreground">Nothing matches this search.</p>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-base">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              className="h-11 px-5 text-base"
              render={<Link href={pageHref(Math.max(1, page - 1))}>Previous</Link>}
            />
            <Button
              variant="outline"
              disabled={page >= totalPages}
              className="h-11 px-5 text-base"
              render={<Link href={pageHref(Math.min(totalPages, page + 1))}>Next</Link>}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
