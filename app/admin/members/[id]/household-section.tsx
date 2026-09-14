"use client";

import { useActionState, useState } from "react";
import type { HouseholdMember } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addHouseholdMember, deleteHouseholdMember, updateHouseholdMember } from "./actions";

type HouseholdMemberWithLink = HouseholdMember & {
  linkedMember: { id: string; memberNumber: string | null; surname: string; firstName: string } | null;
};

export function HouseholdSection({
  memberId,
  household,
  canEdit,
}: {
  memberId: string;
  household: HouseholdMemberWithLink[];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {household.length === 0 ? (
        <p className="text-sm text-muted-foreground">No household members recorded.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {household.map((entry) => (
            <HouseholdRow key={entry.id} memberId={memberId} entry={entry} canEdit={canEdit} />
          ))}
        </ul>
      )}

      {canEdit ? <HouseholdAddForm memberId={memberId} /> : null}
    </div>
  );
}

function HouseholdRow({
  memberId,
  entry,
  canEdit,
}: {
  memberId: string;
  entry: HouseholdMemberWithLink;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const boundUpdate = updateHouseholdMember.bind(null, memberId, entry.id);
  const [state, formAction, isPending] = useActionState(boundUpdate, {});

  if (editing) {
    return (
      <li className="rounded-md border p-3">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Full name</Label>
            <Input name="fullName" defaultValue={entry.fullName} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Age</Label>
            <Input name="age" type="number" defaultValue={entry.age?.toString() ?? ""} className="w-20" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Relationship</Label>
            <Input name="relationship" defaultValue={entry.relationship ?? ""} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Linked member number</Label>
            <Input name="linkedMemberNumber" defaultValue={entry.linkedMember?.memberNumber ?? ""} placeholder="AHL/M/2026/0001" />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
      <span>
        {entry.fullName}
        {entry.age !== null ? `, ${entry.age}` : ""}
        {entry.relationship ? ` (${entry.relationship})` : ""}
        {entry.linkedMember ? ` — linked to ${entry.linkedMember.surname} ${entry.linkedMember.firstName}` : ""}
      </span>
      {canEdit ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <form action={deleteHouseholdMember}>
            <input type="hidden" name="memberId" value={memberId} />
            <input type="hidden" name="householdMemberId" value={entry.id} />
            <Button type="submit" size="sm" variant="destructive">
              Remove
            </Button>
          </form>
        </div>
      ) : null}
    </li>
  );
}

function HouseholdAddForm({ memberId }: { memberId: string }) {
  const boundAdd = addHouseholdMember.bind(null, memberId);
  const [state, formAction, isPending] = useActionState(boundAdd, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Full name</Label>
        <Input name="fullName" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Age</Label>
        <Input name="age" type="number" className="w-20" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Relationship</Label>
        <Input name="relationship" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Linked member number (optional)</Label>
        <Input name="linkedMemberNumber" placeholder="AHL/M/2026/0001" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Adding..." : "Add household member"}
      </Button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
