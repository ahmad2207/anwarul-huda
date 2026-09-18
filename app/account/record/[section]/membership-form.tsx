"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Branch } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [error, formAction, isPending] = useActionState(saveMembershipSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Read only to the member (MEMBER-INTERFACE.md 3.4): shown, not
          hidden, so a member who thinks one of these is wrong can see
          that it is wrong, with a line saying who can change it. None
          of these four are inputs, so there is nothing here for a save
          to submit even if the form were tampered with. */}
      <div className="flex flex-col gap-3 rounded-[4px] border border-border bg-paper-dim p-4">
        <ReadOnlyField label="Wing" value={wingName} />
        <ReadOnlyField label="Membership status" value={STATUS_LABELS[status] ?? status} />
        <ReadOnlyField label="Member number" value={memberNumber ?? "Not yet issued"} />
        <ReadOnlyField label="Office held" value={officeHeld ?? "None"} />
        <p className="text-sm text-muted-foreground">Only the office can change these.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="yearJoined">Year joined</Label>
        <Input
          id="yearJoined"
          name="yearJoined"
          type="number"
          defaultValue={yearJoined?.toString() ?? ""}
          className="h-11 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="branchId">Masjid or branch</Label>
        <select
          id="branchId"
          name="branchId"
          defaultValue={branchId ?? ""}
          className="h-11 rounded-[4px] border border-input bg-background px-3 text-base"
        >
          <option value="">Not stated</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="halaqah">Halaqah or usrah group</Label>
        <Input id="halaqah" name="halaqah" defaultValue={halaqah ?? ""} className="h-11 text-base" />
      </div>

      {error ? <p className="text-base text-destructive">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} className="h-11 rounded-[4px] px-6 text-base">
          {isPending ? "Saving..." : "Save and continue"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          render={<Link href="/account/record">Cancel</Link>}
          className="h-11 rounded-[4px] px-6 text-base"
        />
      </div>
    </form>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-base font-medium text-muted-foreground">{value}</span>
    </div>
  );
}
