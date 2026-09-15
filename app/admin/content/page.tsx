import Link from "next/link";
import type { ContentItem, Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { StatusTag } from "@/components/status-tag";
import type { StatusTone } from "@/components/status-tag";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
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

// A scheduled item is waiting for its publish time, the same kind of
// wait as a pending approval, so it gets the same attention tone. A
// draft is just where it is in the workflow, not a state to flag.
function statusTone(item: Pick<ContentItem, "isPublished" | "publishAt">): StatusTone {
  if (!item.isPublished) return "neutral";
  if (item.publishAt && item.publishAt.getTime() > Date.now()) return "attention";
  return "confirmed";
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

  const columns: DataTableColumn<ContentItem>[] = [
    {
      key: "title",
      header: "Title",
      cell: (item) => (
        <>
          <p className="font-medium">{item.title}</p>
          {item.author ? <p className="text-xs text-muted-foreground">{item.author}</p> : null}
        </>
      ),
    },
    { key: "type", header: "Type", cell: (item) => TYPE_LABELS[item.type] ?? item.type },
    {
      key: "wing",
      header: "Wing",
      cell: (item) => (item.wingId ? wingNames.get(item.wingId) ?? "Unknown wing" : "All wings"),
    },
    {
      key: "status",
      header: "Status",
      cell: (item) => <StatusTag tone={statusTone(item)}>{statusLabel(item)}</StatusTag>,
    },
    { key: "downloads", header: "Downloads", cell: (item) => item.downloadCount },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Content" description="Sermons, weekly books, articles and announcements." />

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
            <FormField label="Title or author" htmlFor="q" className="min-w-48 flex-1">
              <Input id="q" name="q" defaultValue={q} placeholder="Search..." autoFocus />
            </FormField>
            <FormField label="Type" htmlFor="type">
              <select
                id="type"
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
            </FormField>
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <DataTable columns={columns} rows={items} rowKey={(item) => item.id} emptyMessage="Nothing uploaded yet." />

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
