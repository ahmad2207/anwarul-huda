import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { canEditMemberRecords, canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatNigerianPhoneForDisplay } from "@/lib/phone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditMemberForm } from "./edit-member-form";
import { StatusChangeForm } from "./status-form";
import { HouseholdSection } from "./household-section";

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole(["WING_ADMIN", "FINANCE_OFFICER", "ATTENDANCE_OFFICER"]);

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      wing: true,
      branch: true,
      household: { include: { linkedMember: true }, orderBy: { fullName: "asc" } },
      serviceAreas: true,
    },
  });

  if (!member) {
    notFound();
  }

  if (!canViewAllWings(user) && !user.wingIds.includes(member.wingId)) {
    notFound();
  }

  const canEdit = canEditMemberRecords(user, member.wingId);

  const [branches, serviceAreas] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    prisma.serviceArea.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">
            {member.surname} {member.firstName} {member.otherNames ?? ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {member.memberNumber ?? "No member number yet"} &middot; {member.wing.name} &middot;{" "}
            {statusLabel(member.status)}
          </p>
        </div>
        {canEdit ? <StatusChangeForm memberId={member.id} currentStatus={member.status} /> : null}
      </div>

      {member.statusReason ? (
        <p className="text-sm text-muted-foreground">
          Status reason: {member.statusReason}
          {member.statusAt ? ` (${member.statusAt.toLocaleDateString("en-NG")})` : ""}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Record</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <EditMemberForm member={member} branches={branches} serviceAreas={serviceAreas} />
          ) : (
            <ReadOnlyMember member={member} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Household</CardTitle>
        </CardHeader>
        <CardContent>
          <HouseholdSection memberId={member.id} household={member.household} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}

type MemberWithRelations = Prisma.MemberGetPayload<{
  include: {
    wing: true;
    branch: true;
    household: { include: { linkedMember: true } };
    serviceAreas: true;
  };
}>;

function ReadOnlyMember({ member }: { member: MemberWithRelations }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      <Row label="Phone" value={formatNigerianPhoneForDisplay(member.phone)} />
      <Row label="Email" value={member.email ?? "Not provided"} />
      <Row label="Gender" value={member.gender === "MALE" ? "Male" : "Female"} />
      <Row label="Occupation" value={member.occupation ?? "Not provided"} />
      <Row label="Branch" value={member.branch?.name ?? "Not assigned"} />
      <Row label="Year joined" value={member.yearJoined?.toString() ?? "Not provided"} />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
