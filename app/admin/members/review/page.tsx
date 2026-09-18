import Link from "next/link";
import type { Member, Wing } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMemberName } from "@/lib/members/display-name";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { markWingReviewDone } from "./actions";

type ReviewRow = Member & { wing: Wing };

// A light review, not an approval (MEMBER-INTERFACE.md 3.4, M3 #9): a
// member lands here once, on completing all nine sections of their own
// record, and again on any later change to their name, phone or
// address. Nothing about their status, wing or membership changes by
// being on this list, and nothing here is gated behind it.
export default async function WingReviewPage() {
  const user = await requireRole(["WING_ADMIN"]);
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");

  const members = await prisma.member.findMany({
    where: {
      needsWingReview: true,
      ...(isSuperAdmin ? {} : { wingId: { in: user.wingIds } }),
    },
    include: { wing: true },
    orderBy: { wingReviewRequestedAt: "asc" },
  });

  const columns: DataTableColumn<ReviewRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (member) => (
        <Link href={`/admin/members/${member.id}`} className="font-medium underline-offset-2 hover:underline">
          {formatMemberName(member)}
        </Link>
      ),
    },
    { key: "wing", header: "Wing", cell: (member) => member.wing.name },
    { key: "memberNumber", header: "Member number", cell: (member) => member.memberNumber ?? "Not yet issued" },
    {
      key: "reason",
      header: "Reason",
      cell: (member) => <span className="text-sm">{member.wingReviewReason ?? "Flagged for review"}</span>,
    },
    {
      key: "when",
      header: "When",
      cell: (member) =>
        member.wingReviewRequestedAt
          ? member.wingReviewRequestedAt.toLocaleDateString("en-NG", { day: "numeric", month: "short" })
          : "",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (member) => (
        <form action={markWingReviewDone}>
          <input type="hidden" name="memberId" value={member.id} />
          <Button type="submit" variant="outline" size="sm">
            Mark reviewed
          </Button>
        </form>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Record reviews"
        description={`${members.length} member${members.length === 1 ? "" : "s"} whose record needs a look, not an approval`}
      />

      <DataTable
        columns={columns}
        rows={members}
        rowKey={(member) => member.id}
        emptyMessage="Nothing waiting on a review."
        alignRowsTop
      />
    </div>
  );
}
