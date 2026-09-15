import Link from "next/link";
import type { ContentItem, Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ContentForm } from "./content-form";
import { CONTENT_TYPES } from "./schema";

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<string, string> = {
  SERMON: "Sermon",
  WEEKLY_BOOK: "Weekly book",
  ARTICLE: "Article",
  ANNOUNCEMENT: "Announcement",
};

function statusLabel(item: Pick<ContentItem, "isPublished" | "publishAt">): string {
  if (!item.isPublished) return "Draft";
  if (item.publishAt && item.publishAt.getTime() > Date.now()) {
    return `Scheduled for ${item.publishAt.toLocaleString("en-NG")}`;
  }
  return "Published";
}

export default async function ContentAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["CONTENT_EDITOR"]);
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q.trim() : "";
  const typeParam = typeof params.type === "string" ? params.type : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const wings = await prisma.wing.findMany({ orderBy: { name: "asc" } });

  const and: Prisma.ContentItemWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { author: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if ((CONTENT_TYPES as readonly string[]).includes(typeParam)) {
    and.push({ type: typeParam as (typeof CONTENT_TYPES)[number] });
  }
  const where: Prisma.ContentItemWhereInput = and.length > 0 ? { AND: and } : {};

  const [items, total] = await Promise.all([
    prisma.contentItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.contentItem.count({ where }),
  ]);

  // ContentItem stores wingId directly with no relation declared on the
  // model, so the name is looked up from the wings already fetched for
  // the upload form's select, rather than an include.
  const wingNames = new Map(wings.map((wing) => [wing.id, wing.name]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (typeParam) next.set("type", typeParam);
    next.set("page", String(targetPage));
    return `/admin/content?${next.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Content</h1>
        <p className="text-sm text-muted-foreground">Sermons, weekly books, articles and announcements.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <ContentForm wings={wings} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1">
              <Label className="text-xs">Title or author</Label>
              <Input name="q" defaultValue={q} placeholder="Search..." />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Type</Label>
              <select
                name="type"
                defaultValue={typeParam}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All types</option>
                {CONTENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-2 font-medium">Title</th>
              <th className="p-2 font-medium">Type</th>
              <th className="p-2 font-medium">Wing</th>
              <th className="p-2 font-medium">Status</th>
              <th className="p-2 font-medium">Downloads</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="p-2">
                  <p className="font-medium">{item.title}</p>
                  {item.author ? <p className="text-xs text-muted-foreground">{item.author}</p> : null}
                </td>
                <td className="p-2">{TYPE_LABELS[item.type] ?? item.type}</td>
                <td className="p-2">{item.wingId ? wingNames.get(item.wingId) ?? "Unknown wing" : "All wings"}</td>
                <td className="p-2">{statusLabel(item)}</td>
                <td className="p-2">{item.downloadCount}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  Nothing uploaded yet.
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
