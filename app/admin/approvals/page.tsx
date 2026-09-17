import type { Member, Wing } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findPotentialDuplicates } from "@/lib/duplicates";
import type { DuplicateMatch } from "@/lib/duplicates";
import { formatNigerianPhoneForDisplay } from "@/lib/phone";
import { formatMemberName } from "@/lib/members/display-name";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusTag } from "@/components/status-tag";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { approveMember } from "./actions";
import { RejectMemberForm } from "./reject-member-form";

interface PendingRow {
  member: Member & { wing: Wing };
  duplicates: DuplicateMatch[];
}

export default async function ApprovalsPage() {
  const user = await requireRole(["WING_ADMIN"]);
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");

  const pendingMembers = await prisma.member.findMany({
    where: {
      status: "PENDING",
      ...(isSuperAdmin ? {} : { wingId: { in: user.wingIds } }),
    },
    include: { wing: true },
    orderBy: { createdAt: "asc" },
  });

  const withDuplicates = await Promise.all(
    pendingMembers.map(async (member) => ({
      member,
      duplicates: await findPotentialDuplicates(prisma, {
        id: member.id,
        // Non-null: this queue is scoped to PENDING members, who only
        // arrive through self registration or admin entry, both of which
        // require a phone. A nominal roll import is never PENDING.
        phone: member.phone!,
        surname: member.surname,
        firstName: member.firstName,
      }),
    })),
  );

  const columns: DataTableColumn<PendingRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: ({ member }) => (
        <span className="font-medium">
          {formatMemberName(member)} {member.otherNames ?? ""}
        </span>
      ),
    },
    { key: "wing", header: "Wing", cell: ({ member }) => member.wing.name },
    { key: "phone", header: "Phone", cell: ({ member }) => formatNigerianPhoneForDisplay(member.phone) },
    { key: "gender", header: "Gender", cell: ({ member }) => (member.gender === "MALE" ? "Male" : "Female") },
    { key: "registered", header: "Registered", cell: ({ member }) => member.createdAt.toLocaleDateString("en-NG") },
    {
      key: "duplicates",
      header: "Duplicates",
      cell: ({ duplicates }) =>
        duplicates.length === 0 ? (
          <StatusTag tone="neutral">None</StatusTag>
        ) : (
          <div className="flex flex-col gap-1">
            <StatusTag tone="attention">
              {duplicates.length} possible {duplicates.length === 1 ? "match" : "matches"}
            </StatusTag>
            <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {duplicates.map((duplicate) => (
                <li key={duplicate.member.id}>
                  {duplicate.member.surname} {duplicate.member.firstName} (
                  {duplicate.member.memberNumber ?? duplicate.member.status.toLowerCase()}),{" "}
                  {duplicate.matchedOnPhone ? "same phone" : `${Math.round(duplicate.nameSimilarity * 100)}% name match`}
                </li>
              ))}
            </ul>
          </div>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: ({ member }) => (
        <div className="flex flex-wrap items-center gap-2">
          <form action={approveMember}>
            <input type="hidden" name="memberId" value={member.id} />
            <Button type="submit" size="sm">
              Approve
            </Button>
          </form>
          <RejectMemberForm memberId={member.id} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Approval queue"
        description={`${pendingMembers.length} pending registration${pendingMembers.length === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={withDuplicates}
        rowKey={(row) => row.member.id}
        emptyMessage="Nothing waiting for approval."
        alignRowsTop
      />
    </div>
  );
}
