"use client";

import { useActionState, useState } from "react";
import type { HouseholdMember } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMemberName } from "@/lib/members/display-name";
import {
  addOwnHouseholdMember,
  updateOwnHouseholdMember,
  removeOwnHouseholdMember,
  completeHouseholdSection,
} from "./actions";

type HouseholdMemberWithLink = HouseholdMember & {
  linkedMember: {
    id: string;
    memberNumber: string | null;
    surname: string | null;
    firstName: string | null;
    fullNameAsWritten: string | null;
  } | null;
};

export function HouseholdSectionForm({ household }: { household: HouseholdMemberWithLink[] }) {
  const [, completeAction, isCompleting] = useActionState(completeHouseholdSection, undefined);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base text-muted-foreground">Spouse or spouses, children and others who live with you.</p>

      {household.length === 0 ? (
        <p className="text-base text-muted-foreground">
          Nobody added yet. If you live alone, there is nothing to add here, just continue below.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {household.map((entry) => (
            <HouseholdRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      <HouseholdAddForm />

      <form action={completeAction}>
        <Button type="submit" disabled={isCompleting} className="h-11 rounded-[4px] px-6 text-base">
          {isCompleting ? "Saving..." : "Save and continue"}
        </Button>
      </form>
    </div>
  );
}

function HouseholdRow({ entry }: { entry: HouseholdMemberWithLink }) {
  const [editing, setEditing] = useState(false);
  const boundUpdate = updateOwnHouseholdMember.bind(null, entry.id);
  const [state, formAction, isPending] = useActionState(boundUpdate, {});

  if (editing) {
    return (
      <li className="rounded-[4px] border border-border p-3">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`household-${entry.id}-fullName`}>Full name</Label>
            <Input
              id={`household-${entry.id}-fullName`}
              name="fullName"
              defaultValue={entry.fullName}
              required
              className="h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`household-${entry.id}-age`}>Age</Label>
            <Input
              id={`household-${entry.id}-age`}
              name="age"
              type="number"
              defaultValue={entry.age?.toString() ?? ""}
              className="h-11 w-24 text-base"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`household-${entry.id}-relationship`}>Relationship</Label>
            <Input
              id={`household-${entry.id}-relationship`}
              name="relationship"
              defaultValue={entry.relationship ?? ""}
              className="h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`household-${entry.id}-linkedMemberNumber`}>Their member number, if they have one</Label>
            <Input
              id={`household-${entry.id}-linkedMemberNumber`}
              name="linkedMemberNumber"
              defaultValue={entry.linkedMember?.memberNumber ?? ""}
              placeholder="AHL/M/2026/0001"
              className="h-11 text-base"
            />
          </div>
          {state.error ? <p className="text-base text-destructive">{state.error}</p> : null}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending} className="h-11 rounded-[4px] px-6 text-base">
              {isPending ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-[4px] px-6 text-base"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-border bg-paper-dim p-3">
      <span className="text-base">
        {entry.fullName}
        {entry.age !== null ? `, ${entry.age}` : ""}
        {entry.relationship ? ` (${entry.relationship})` : ""}
        {entry.linkedMember ? `, linked to ${formatMemberName(entry.linkedMember)}` : ""}
      </span>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <form action={removeOwnHouseholdMember}>
          <input type="hidden" name="householdMemberId" value={entry.id} />
          <Button type="submit" variant="destructive" size="sm">
            Remove
          </Button>
        </form>
      </div>
    </li>
  );
}

function HouseholdAddForm() {
  const [state, formAction, isPending] = useActionState(addOwnHouseholdMember, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[4px] border border-dashed border-border p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="household-add-fullName">Full name</Label>
        <Input id="household-add-fullName" name="fullName" required className="h-11 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="household-add-age">Age</Label>
        <Input id="household-add-age" name="age" type="number" className="h-11 w-24 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="household-add-relationship">Relationship</Label>
        <Input id="household-add-relationship" name="relationship" className="h-11 text-base" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="household-add-linkedMemberNumber">Their member number, if they have one</Label>
        <Input
          id="household-add-linkedMemberNumber"
          name="linkedMemberNumber"
          placeholder="AHL/M/2026/0001"
          className="h-11 text-base"
        />
      </div>
      {state.error ? <p className="text-base text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={isPending} className="h-11 self-start rounded-[4px] px-6 text-base">
        {isPending ? "Adding..." : "Add household member"}
      </Button>
    </form>
  );
}
