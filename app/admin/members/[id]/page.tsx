import Link from "next/link";
import { notFound } from "next/navigation";
import type { MemberSource, Prisma } from "@prisma/client";
import { canEditMemberRecords, canViewCharityHistory } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatNigerianPhoneForDisplay } from "@/lib/phone";
import { formatMemberName } from "@/lib/members/display-name";
import { RECORD_SECTIONS } from "@/lib/members/record-sections";
import { generateMemberQrDataUrl } from "@/lib/qr/member-qr";
import { formatLagosDate } from "@/lib/timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status-tag";
import type { StatusTone } from "@/components/status-tag";
import { BackLink } from "@/components/back-link";
import { EditMemberForm } from "./edit-member-form";
import { StatusChangeForm } from "./status-form";
import { HouseholdSection } from "./household-section";
import { loadViewableMember, type ViewableMember } from "./load-member";
import { parseAttendanceFilter } from "./attendance-filter";
import { parsePage } from "./tab-pager";
import { AttendanceTab } from "./attendance-tab";
import { PaymentsTab } from "./payments-tab";
import { AccountTab } from "./account-tab";
import { ActivityTab } from "./activity-tab";
import { CharityTab } from "./charity-tab";

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

const TABS = [
  { key: "record", label: "Record" },
  { key: "attendance", label: "Attendance" },
  { key: "payments", label: "Payments" },
  { key: "household", label: "Household" },
  { key: "account", label: "Account and access" },
  { key: "activity", label: "Activity" },
  { key: "charity", label: "Charity" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// MEMBER-HOME-AND-ADMIN-VIEW.md 2: everything the system knows about a
// member, in one place. Each tab is a plain link and only the open tab's
// data is loaded. Role and wing scope are checked once, in
// loadViewableMember, before anything else runs.
export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const loaded = await loadViewableMember(id);
  if (!loaded) {
    notFound();
  }
  const { user, member } = loaded;

  const query = await searchParams;
  const param = (name: string) => (typeof query[name] === "string" ? (query[name] as string) : undefined);

  // The charity tab is not offered at all to a viewer who may not see it,
  // and asking for it by URL falls back to the record rather than
  // rendering anything (2.7).
  const showCharity = canViewCharityHistory(user);
  const tabs = TABS.filter((tab) => tab.key !== "charity" || showCharity);
  const requested = param("tab");
  const activeTab: TabKey = tabs.some((tab) => tab.key === requested) ? (requested as TabKey) : "record";

  const canEdit = canEditMemberRecords(user, member.wingId);
  const page = parsePage(param("page"));

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/admin/members" label="Back to members" />
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
          {member.statusAt ? ` (${formatLagosDate(member.statusAt)})` : ""}
        </p>
      ) : null}

      <nav aria-label="Member sections" className="flex flex-wrap gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "record" ? `/admin/members/${member.id}` : `/admin/members/${member.id}?tab=${tab.key}`}
            aria-current={tab.key === activeTab ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab.key === activeTab
                ? "border-navy-900 font-medium text-navy-900"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === "record" ? <RecordTab member={member} canEdit={canEdit} /> : null}
      {activeTab === "attendance" ? (
        <AttendanceTab
          member={member}
          filter={parseAttendanceFilter({ from: param("from"), to: param("to"), type: param("type") })}
          page={page}
        />
      ) : null}
      {activeTab === "payments" ? (
        <PaymentsTab memberId={member.id} page={page} contributionsPage={parsePage(param("cpage"))} />
      ) : null}
      {activeTab === "household" ? (
        <Card>
          <CardContent className="pt-6">
            <HouseholdSection memberId={member.id} household={member.household} canEdit={canEdit} />
          </CardContent>
        </Card>
      ) : null}
      {activeTab === "account" ? <AccountTab member={member} canEdit={canEdit} /> : null}
      {activeTab === "activity" ? (
        <ActivityTab member={{ id: member.id, userId: member.user?.id ?? null }} page={page} />
      ) : null}
      {activeTab === "charity" && showCharity ? <CharityTab viewer={user} memberId={member.id} /> : null}
    </div>
  );
}

// Where a section's content came from, when the member has not
// completed it themselves (2.1). The record as a whole has one source,
// so this says where the unconfirmed sections came from, not who typed
// each field.
const SOURCE_LABELS: Record<MemberSource, string> = {
  CSV_IMPORT: "Imported, not yet confirmed by the member",
  ADMIN_ENTRY: "Entered by the office",
  SELF_REGISTRATION: "From the registration form",
};

async function RecordTab({ member, canEdit }: { member: ViewableMember; canEdit: boolean }) {
  const [branches, serviceAreas, qrDataUrl] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    prisma.serviceArea.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    member.memberNumber ? generateMemberQrDataUrl(member.memberNumber) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Who completed each section</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {RECORD_SECTIONS.map((section) => {
              const byMember = member.completedSections.includes(section.section);
              return (
                <li key={section.key} className="flex items-center justify-between gap-3">
                  <span>
                    {section.order}. {section.label}
                  </span>
                  {byMember ? (
                    <StatusTag tone="confirmed">Completed by the member</StatusTag>
                  ) : (
                    <span className="text-right text-xs text-muted-foreground">{SOURCE_LABELS[member.source]}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

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
