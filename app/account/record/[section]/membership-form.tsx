"use client";

import type { Branch } from "@prisma/client";
import { Field, FormError, SectionActions, SelectField } from "@/components/member/form";
import { useRememberedForm } from "@/components/member/use-remembered-form";
import { saveMembershipSection } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  OCCASIONAL: "Occasional",
  RELOCATED: "Relocated",
  HONORARY: "Honorary",
  INACTIVE: "Inactive",
  DECEASED: "Deceased",
  REJECTED: "Rejected",
};

export function MembershipSectionForm({
  wingName,
  status,
  memberNumber,
  officeHeld,
  yearJoined,
  branchId,
  halaqah,
  branches,
}: {
  wingName: string;
  status: string;
  memberNumber: string | null;
  officeHeld: string | null;
  yearJoined: number | null;
  branchId: string | null;
  halaqah: string | null;
  branches: Branch[];
}) {
  const { state: error, formAction, isPending, value } = useRememberedForm(saveMembershipSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Read only to the member (MEMBER-INTERFACE.md 3.4): shown, not
          hidden, so a member who thinks one of these is wrong can see
          that it is wrong, with a line saying who can change it. None
          of these four are inputs, so there is nothing here for a save
          to submit even if the form were tampered with. */}
      <dl className="grid grid-cols-1 gap-3 rounded-[14px] bg-paper-dim p-4 sm:grid-cols-2">
        <ReadOnlyField label="Wing" value={wingName} />
        <ReadOnlyField label="Membership status" value={STATUS_LABELS[status] ?? status} />
        <ReadOnlyField label="Member number" value={memberNumber ?? "Not yet issued"} mono={Boolean(memberNumber)} />
        <ReadOnlyField label="Office held" value={officeHeld ?? "None"} />
        <p className="text-sm text-ink-2 sm:col-span-2">Only the office can change these.</p>
      </dl>

      <Field
        label="Year joined"
        id="yearJoined"
        type="number"
        inputMode="numeric"
        defaultValue={value("yearJoined", yearJoined?.toString() ?? "")}
      />
      <SelectField
        label="Masjid or branch"
        id="branchId"
        placeholder="Not stated"
        defaultValue={value("branchId", branchId ?? "")}
        options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
      />
      <Field label="Halaqah or usrah group" id="halaqah" defaultValue={value("halaqah", halaqah ?? "")} />

      <FormError>{error}</FormError>
      <SectionActions isPending={isPending} />
    </form>
  );
}

function ReadOnlyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className={`text-base font-semibold text-ink ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
