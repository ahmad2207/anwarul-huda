import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { canEditMemberRecords, canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatNigerianPhoneForDisplay } from "@/lib/phone";
import { formatMemberName } from "@/lib/members/display-name";
import { generateMemberQrDataUrl } from "@/lib/qr/member-qr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status-tag";
import type { StatusTone } from "@/components/status-tag";
import { EditMemberForm } from "./edit-member-form";
import { StatusChangeForm } from "./status-form";
import { HouseholdSection } from "./household-section";
import { IssueLoginCard } from "./issue-login-card";

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
      user: true,
    },
  });

  if (!member) {
    notFound();
  }

  if (!canViewAllWings(user) && !user.wingIds.includes(member.wingId)) {
    notFound();
  }

  const canEdit = canEditMemberRecords(user, member.wingId);

  const [branches, serviceAreas, qrDataUrl] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    prisma.serviceArea.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    member.memberNumber ? generateMemberQrDataUrl(member.memberNumber) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">
            {formatMemberName(member)} {member.otherNames ?? ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {member.memberNumber ?? "No member number yet"} &middot; {member.wing.name} &middot;{" "}
            <StatusTag tone={statusTone(member.status)}>{statusLabel(member.status)}</StatusTag>
            {member.isRecordIncomplete ? (
              <>
                {" "}
                &middot; <StatusTag tone="attention">Incomplete record</StatusTag>
              </>
            ) : null}
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

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Login</CardTitle>
          </CardHeader>
          <CardContent>
            <IssueLoginCard
              memberId={member.id}
              memberNumber={member.memberNumber}
              hasAccount={member.user !== null}
              mustChangePassword={member.user?.mustChangePassword ?? false}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Household</CardTitle>
        </CardHeader>
        <CardContent>
          <HouseholdSection memberId={member.id} household={member.household} canEdit={canEdit} />
        </CardContent>
      </Card>

      {member.memberNumber && qrDataUrl ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Attendance QR code</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a
                small server generated data URL, not a served image asset */}
            <img src={qrDataUrl} alt={`QR code for ${member.memberNumber}`} width={120} height={120} />
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Scanned at check-in to identify this member. Printed on their card.
              </p>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/admin/members/${member.id}/card`}>Print card</Link>}
                className="self-start"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
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
