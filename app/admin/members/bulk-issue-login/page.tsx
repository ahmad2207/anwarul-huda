import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatMemberName } from "@/lib/members/display-name";
import { PageHeader } from "@/components/page-header";
import { BulkIssueLoginForm } from "./bulk-issue-login-form";

// Only a member with no login yet is offered here: reissuing for someone
// who already has one is a deliberate, single-member action from their
// own page (see app/admin/members/[id]/issue-login-card.tsx), never a
// side effect of a bulk sweep that happens to include them.
//
// Eligibility is a member number, not a phone number (MEMBER-INTERFACE.md
// 1 and 2): a member number is what login uses now, and every imported
// member already has one, issued at import or at approval. A member with
// no number yet has nothing to log in with regardless of phone, so that
// is what excludes a row here, not a missing phone.
export default async function BulkIssueLoginPage() {
  const user = await requireRole(["WING_ADMIN"]);
  const canSeeAllWings = canViewAllWings(user);
  const wingScope = canSeeAllWings ? {} : { wingId: { in: user.wingIds } };

  const [eligible, notYetApproved] = await Promise.all([
    prisma.member.findMany({
      where: { ...wingScope, memberNumber: { not: null }, user: null },
      include: { wing: true },
      orderBy: [{ surname: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
    prisma.member.findMany({
      where: { ...wingScope, memberNumber: null, user: null },
      orderBy: [{ surname: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Bulk issue logins"
        description="Issue a temporary password to every selected member who has a member number and no login yet."
      />

      <BulkIssueLoginForm
        eligibleMembers={eligible.map((member) => ({
          id: member.id,
          name: formatMemberName(member),
          // Non-null: this list is filtered to memberNumber: { not: null } above.
          memberNumber: member.memberNumber!,
          wingName: member.wing.name,
        }))}
        notYetApprovedNames={notYetApproved.map((member) => formatMemberName(member))}
      />
    </div>
  );
}
