import Link from "next/link";
import type { ContentItem, Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LAGOS_TIME_ZONE } from "@/lib/timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { StatusTag } from "@/components/status-tag";
import type { StatusTone } from "@/components/status-tag";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { AnnouncementForm } from "./announcement-form";

const PAGE_SIZE = 20;

type AnnouncementRow = Pick<ContentItem, "id" | "title" | "body" | "wingId" | "isPublished" | "publishAt" | "createdAt">;

function formatLagos(instant: Date): string {
  return instant.toLocaleString("en-GB", {
    timeZone: LAGOS_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function status(item: AnnouncementRow, now: Date): { label: string; tone: StatusTone } {
  if (!item.isPublished) return { label: "Draft", tone: "neutral" };
  if (item.publishAt && item.publishAt > now) {
    return { label: `Scheduled for ${formatLagos(item.publishAt)}`, tone: "attention" };
  }
  return { label: "Published", tone: "confirmed" };
}

// Announcements get their own page rather than only a type in the
// general upload form: they are short notices with no file, posted
// often, and the member home shows the most recent live one under
// "Latest" (MEMBER-HOME-AND-ADMIN-VIEW.md 1.5).
export default async function AnnouncementsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["CONTENT_EDITOR"]);
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const where: Prisma.ContentItemWhereInput = {
    type: "ANNOUNCEMENT",
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [wings, items, total] = await Promise.all([
    prisma.wing.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contentItem.findMany({
      where,
      select: { id: true, title: true, body: true, wingId: true, isPublished: true, publishAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.contentItem.count({ where }),
  ]);

  const wingNames = new Map(wings.map((wing) => [wing.id, wing.name]));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date();

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(targetPage));
    return `/admin/content/announcements?${next.toString()}`;
  }

  const columns: DataTableColumn<AnnouncementRow>[] = [
    {
      key: "title",
      header: "Announcement",
      cell: (item) => (
        <>
          <p className="font-medium">{item.title}</p>
          {item.body ? <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p> : null}
        </>
      ),
    },
    {
      key: "wing",
      header: "Who sees it",
      cell: (item) => (item.wingId ? wingNames.get(item.wingId) ?? "Unknown wing" : "All wings"),
    },
    { key: "posted", header: "Posted", cell: (item) => formatLagos(item.createdAt) },
    {
      key: "status",
      header: "Status",
      cell: (item) => {
        const { label, tone } = status(item, now);
        return <StatusTag tone={tone}>{label}</StatusTag>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Announcements"
        description="Short notices for members, such as a cancelled ta'leem. The newest published one shows on each member's home screen."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">New announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnouncementForm wings={wings} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <FormField label="Title or message" htmlFor="q" className="min-w-48 flex-1">
              <Input id="q" name="q" defaultValue={q} />
            </FormField>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(item) => item.id}
        emptyMessage={q ? "No announcements match that search." : "No announcements yet. Post one above."}
      />

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
