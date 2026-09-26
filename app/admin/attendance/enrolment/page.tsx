import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEnrolmentWorklist, type WorklistFilter } from "@/lib/face/enrolment-worklist";
import { formatMemberName } from "@/lib/members/display-name";
import { formatLagosDate } from "@/lib/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { StatusTag } from "@/components/status-tag";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { TabPager, parsePage } from "@/app/admin/members/[id]/tab-pager";
import { DeclineFaceForm } from "./decline-form";

const PAGE_SIZE = 25;

const FILTERS: Array<{ value: WorklistFilter; label: string }> = [
  { value: "all", label: "Everyone still to set up" },
  { value: "deferred", label: "Asked for help" },
  { value: "never", label: "Never started" },
];

type WorklistRow = Awaited<ReturnType<typeof getEnrolmentWorklist>>["members"][number];

// MEMBER-INTERFACE.md M5: the office's list of members still to set up for
// face check-in, worked through at gatherings. For officers only, never
// shown to members, and never a score: a member checked in by name every
// week is recorded just as fully as one checked in by face.
export default async function EnrolmentWorklistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const officer = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const params = await searchParams;
  const param = (name: string) => (typeof params[name] === "string" ? (params[name] as string) : "");

  const filter = FILTERS.find((option) => option.value === param("filter"))?.value ?? "all";
  const wingId = param("wingId") || undefined;
  const search = param("q").trim() || undefined;
  const page = parsePage(param("page") || undefined);

  const isSuperAdmin = officer.roles.includes("SUPER_ADMIN");
  const [wings, { members, total }] = await Promise.all([
    prisma.wing.findMany({
      where: isSuperAdmin ? {} : { id: { in: officer.wingIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getEnrolmentWorklist(officer, { wingId, filter, search }, { page, pageSize: PAGE_SIZE }),
  ]);

  const linkParams: Record<string, string> = {
    ...(filter !== "all" ? { filter } : {}),
    ...(wingId ? { wingId } : {}),
    ...(search ? { q: search } : {}),
  };

  const columns: DataTableColumn<WorklistRow>[] = [
    {
      key: "member",
      header: "Member",
      cell: (row) => (
        <>
          <Link href={`/admin/members/${row.id}?tab=account`} className="font-medium underline-offset-2 hover:underline">
            {formatMemberName(row)}
          </Link>
          <p className="font-mono text-xs text-muted-foreground">{row.memberNumber ?? "No member number yet"}</p>
        </>
      ),
    },
    { key: "wing", header: "Wing", cell: (row) => row.wing.name },
    {
      key: "where",
      header: "Where things stand",
      cell: (row) =>
        row.heldForReview ? (
          <StatusTag tone="neutral">Waiting on a face match review</StatusTag>
        ) : row.faceEnrolmentDeferred ? (
          <StatusTag tone="attention">
            Asked for help{row.faceEnrolmentDeferredAt ? ` ${formatLagosDate(row.faceEnrolmentDeferredAt)}` : ""}
          </StatusTag>
        ) : (
          <span className="text-sm text-muted-foreground">Not started</span>
        ),
    },
    {
      key: "actions",
      header: "",
      cell: (row) =>
        row.heldForReview ? (
          <span className="text-xs text-muted-foreground">The review decides the next step.</span>
        ) : (
          <div className="flex flex-col items-start gap-1">
            {row.dateOfBirth ? (
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/admin/members/${row.id}/face`}>Set up with the member</Link>}
              />
            ) : (
              <Link href={`/admin/members/${row.id}`} className="text-xs underline underline-offset-2">
                Add a date of birth first
              </Link>
            )}
            <DeclineFaceForm memberId={row.id} />
          </div>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Face check-in enrolment"
        description="Members still to set up for face check-in. Work through it at gatherings, with each member present."
      />

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <FormField label="Name or member number" htmlFor="q" className="min-w-48 flex-1">
              <Input id="q" name="q" defaultValue={search ?? ""} />
            </FormField>
            <FormField label="Show" htmlFor="filter">
              <select
                id="filter"
                name="filter"
                defaultValue={filter}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            {wings.length > 1 ? (
              <FormField label="Wing" htmlFor="wingId">
                <select
                  id="wingId"
                  name="wingId"
                  defaultValue={wingId ?? ""}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">All your wings</option>
                  {wings.map((wing) => (
                    <option key={wing.id} value={wing.id}>
                      {wing.name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
            <Button type="submit">Filter</Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Members under 18 are not listed: face check-in stays off for them until the committee decides on guardian
            consent. Anyone can always be checked in by name.
          </p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "member" : "members"}
      </p>
      <DataTable
        columns={columns}
        rows={members}
        rowKey={(row) => row.id}
        emptyMessage={search ? "No members match that search." : "Nobody is waiting to be set up."}
        alignRowsTop
      />
      <TabPager
        basePath="/admin/attendance/enrolment"
        params={linkParams}
        pageParam="page"
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
