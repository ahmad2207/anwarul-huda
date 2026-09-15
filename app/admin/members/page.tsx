import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatNigerianPhoneForDisplay } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusTag } from "@/components/status-tag";
import type { StatusTone } from "@/components/status-tag";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  "PENDING",
  "ACTIVE",
  "OCCASIONAL",
  "RELOCATED",
  "HONORARY",
  "INACTIVE",
  "DECEASED",
  "REJECTED",
] as const;

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

// Only pending (awaiting approval), active (approved, in good standing)
// and rejected carry a meaning DESIGN.md names. Everything else is a
// fact about the member, not a state that needs a colour.
function statusTone(status: string): StatusTone {
  if (status === "PENDING") return "attention";
  if (status === "ACTIVE") return "confirmed";
  if (status === "REJECTED") return "alert";
  return "neutral";
}

interface MembersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const params = await searchParams;
  const user = await requireRole(["WING_ADMIN", "FINANCE_OFFICER", "ATTENDANCE_OFFICER"]);
  const canSeeAllWings = canViewAllWings(user);

  const q = typeof params.q === "string" ? params.q.trim() : "";
  const statusParam = typeof params.status === "string" ? params.status : "";
  const wingParam = typeof params.wing === "string" ? params.wing : "";
  const branchParam = typeof params.branch === "string" ? params.branch : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const [wings, branches] = await Promise.all([
    prisma.wing.findMany({ orderBy: { name: "asc" } }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  const visibleWings = canSeeAllWings ? wings : wings.filter((wing) => user.wingIds.includes(wing.id));
  const visibleWingIds = visibleWings.map((wing) => wing.id);

  const where: Prisma.MemberWhereInput = {};
  const and: Prisma.MemberWhereInput[] = [];

  if (!canSeeAllWings) {
    and.push({ wingId: { in: visibleWingIds } });
  }
  if (wingParam && visibleWingIds.includes(wingParam)) {
    and.push({ wingId: wingParam });
  }
  if (statusParam && (STATUS_OPTIONS as readonly string[]).includes(statusParam)) {
    and.push({ status: statusParam as (typeof STATUS_OPTIONS)[number] });
  }
  if (branchParam) {
    and.push({ branchId: branchParam });
  }
  if (q) {
    and.push({
      OR: [
        { surname: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { otherNames: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { memberNumber: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (and.length > 0) {
    where.AND = and;
  }

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      include: { wing: true, branch: true },
      orderBy: [{ surname: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.member.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (statusParam) next.set("status", statusParam);
    if (wingParam) next.set("wing", wingParam);
    if (branchParam) next.set("branch", branchParam);
    next.set("page", String(targetPage));
    return `/admin/members?${next.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          {total} member{total === 1 ? "" : "s"} match{total === 1 ? "es" : ""} this search
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1">
              <Label htmlFor="q" className="text-xs">
                Name, phone or member number
              </Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Search..." />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="status" className="text-xs">
                Status
              </Label>
              <select
                id="status"
                name="status"
                defaultValue={statusParam}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            {visibleWings.length > 1 ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="wing" className="text-xs">
                  Wing
                </Label>
                <select
                  id="wing"
                  name="wing"
                  defaultValue={wingParam}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">All wings</option>
                  {visibleWings.map((wing) => (
                    <option key={wing.id} value={wing.id}>
                      {wing.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <Label htmlFor="branch" className="text-xs">
                Branch
              </Label>
              <select
                id="branch"
                name="branch"
                defaultValue={branchParam}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit">Filter</Button>
            {q || statusParam || wingParam || branchParam ? (
              <Button type="button" variant="ghost" render={<Link href="/admin/members">Clear</Link>} />
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-2 font-medium">Name</th>
              <th className="p-2 font-medium">Member number</th>
              <th className="p-2 font-medium">Phone</th>
              <th className="p-2 font-medium">Wing</th>
              <th className="p-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2">
                  <Link href={`/admin/members/${member.id}`} className="font-medium hover:underline">
                    {member.surname} {member.firstName}
                  </Link>
                </td>
                <td className="p-2 text-muted-foreground">{member.memberNumber ?? "Not yet issued"}</td>
                <td className="p-2">{formatNigerianPhoneForDisplay(member.phone)}</td>
                <td className="p-2">{member.wing.name}</td>
                <td className="p-2">
                  <StatusTag tone={statusTone(member.status)}>{statusLabel(member.status)}</StatusTag>
                </td>
              </tr>
            ))}
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  No members match this search.
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
