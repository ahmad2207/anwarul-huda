import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuditRow } from "./audit-row";
import type { AuditRowData } from "./audit-row";

const PAGE_SIZE = 25;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["SUPER_ADMIN"]);
  const params = await searchParams;

  const actorId = typeof params.actorId === "string" ? params.actorId : "";
  const entity = typeof params.entity === "string" ? params.entity : "";
  const action = typeof params.action === "string" ? params.action.trim() : "";
  const from = typeof params.from === "string" && params.from ? new Date(params.from) : undefined;
  const to = typeof params.to === "string" && params.to ? new Date(params.to) : undefined;
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const [actors, entities] = await Promise.all([
    prisma.user.findMany({
      where: { auditEntries: { some: {} } },
      select: { id: true, email: true, phone: true },
      orderBy: { email: "asc" },
    }),
    // Read straight off what has actually been logged, rather than a
    // fixed list maintained by hand: stays accurate as new mutations
    // start writing to the audit log, with nothing to remember to update
    // here when they do.
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);

  const and: Prisma.AuditLogWhereInput[] = [];
  if (actorId) and.push({ actorId });
  if (entity) and.push({ entity });
  if (action) and.push({ action: { contains: action, mode: "insensitive" } });
  if (from || to) {
    and.push({ createdAt: { gte: from, lte: to } });
  }
  const where: Prisma.AuditLogWhereInput = and.length > 0 ? { AND: and } : {};

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (actorId) next.set("actorId", actorId);
    if (entity) next.set("entity", entity);
    if (action) next.set("action", action);
    if (params.from && typeof params.from === "string") next.set("from", params.from);
    if (params.to && typeof params.to === "string") next.set("to", params.to);
    next.set("page", String(targetPage));
    return `/admin/audit?${next.toString()}`;
  }

  const entries: AuditRowData[] = rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actorLabel: row.actor ? (row.actor.email ?? row.actor.phone ?? "Unknown") : "System",
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    before: row.before,
    after: row.after,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every write to members, payments, disbursements and users, and more besides, with who did it and
          what changed.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Actor</Label>
              <select
                name="actorId"
                defaultValue={actorId}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Anyone</option>
                {actors.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email ?? user.phone ?? user.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Entity</Label>
              <select
                name="entity"
                defaultValue={entity}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All entities</option>
                {entities.map((row) => (
                  <option key={row.entity} value={row.entity}>
                    {row.entity}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Action contains</Label>
              <Input name="action" defaultValue={action} placeholder="e.g. voided" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">From</Label>
              <Input type="date" name="from" defaultValue={typeof params.from === "string" ? params.from : ""} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">To</Label>
              <Input type="date" name="to" defaultValue={typeof params.to === "string" ? params.to : ""} />
            </div>
            <Button type="submit">Filter</Button>
            {actorId || entity || action || params.from || params.to ? (
              <Button type="button" variant="ghost" render={<Link href="/admin/audit">Clear</Link>} />
            ) : null}
          </form>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {total} entr{total === 1 ? "y" : "ies"}
      </p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-2 font-medium">When</th>
              <th className="p-2 font-medium">Actor</th>
              <th className="p-2 font-medium">Action</th>
              <th className="p-2 font-medium">Entity</th>
              <th className="p-2 font-medium">Changes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  No audit entries match this filter.
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
