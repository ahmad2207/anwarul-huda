"use client";

import { useActionState, useState } from "react";
import type { HouseholdMember } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addHouseholdMember, deleteHouseholdMember, updateHouseholdMember } from "./actions";
import { formatMemberName } from "@/lib/members/display-name";

type HouseholdMemberWithLink = HouseholdMember & {
  linkedMember: {
    id: string;
    memberNumber: string | null;
    surname: string | null;
    firstName: string | null;
    fullNameAsWritten: string | null;
  } | null;
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
        <p className="text-sm text-muted-foreground">
          No household members recorded.{canEdit ? " Add one below." : ""}
        </p>
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
            <Label htmlFor={`household-${entry.id}-fullName`} className="text-xs">
              Full name
            </Label>
            <Input id={`household-${entry.id}-fullName`} name="fullName" defaultValue={entry.fullName} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`household-${entry.id}-age`} className="text-xs">
              Age
            </Label>
            <Input
              id={`household-${entry.id}-age`}
              name="age"
              type="number"
              defaultValue={entry.age?.toString() ?? ""}
              className="w-20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`household-${entry.id}-relationship`} className="text-xs">
              Relationship
            </Label>
            <Input
              id={`household-${entry.id}-relationship`}
              name="relationship"
              defaultValue={entry.relationship ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`household-${entry.id}-linkedMemberNumber`} className="text-xs">
              Linked member number
            </Label>
            <Input
              id={`household-${entry.id}-linkedMemberNumber`}
              name="linkedMemberNumber"
              defaultValue={entry.linkedMember?.memberNumber ?? ""}
              placeholder="AHL/M/2026/0001"
            />
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
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-paper-dim p-3 text-sm">
      <span>
        {entry.fullName}
        {entry.age !== null ? `, ${entry.age}` : ""}
        {entry.relationship ? ` (${entry.relationship})` : ""}
        {entry.linkedMember ? `, linked to ${formatMemberName(entry.linkedMember)}` : ""}
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
        <Label htmlFor="household-add-fullName" className="text-xs">
          Full name
        </Label>
        <Input id="household-add-fullName" name="fullName" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="household-add-age" className="text-xs">
          Age
        </Label>
        <Input id="household-add-age" name="age" type="number" className="w-20" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="household-add-relationship" className="text-xs">
          Relationship
        </Label>
        <Input id="household-add-relationship" name="relationship" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="household-add-linkedMemberNumber" className="text-xs">
          Linked member number (optional)
        </Label>
        <Input id="household-add-linkedMemberNumber" name="linkedMemberNumber" placeholder="AHL/M/2026/0001" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Adding..." : "Add household member"}
      </Button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
