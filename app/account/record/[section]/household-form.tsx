"use client";

import { useActionState, useState, useTransition } from "react";
import type { HouseholdMember } from "@prisma/client";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import {
  Field,
  FormError,
  SectionActions,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/member/form";
import { useRememberedForm } from "@/components/member/use-remembered-form";
import {
  addOwnHouseholdMember,
  updateOwnHouseholdMember,
  removeOwnHouseholdMember,
  completeHouseholdSection,
  type HouseholdActionState,
} from "./actions";

type HouseholdMemberWithLink = HouseholdMember & {
  linkedMember: {
    id: string;
    memberNumber: string | null;
  } | null;
};

const smallButtonClass =
  "inline-flex h-11 items-center gap-1.5 rounded-[14px] border border-border bg-white px-4 text-base font-medium transition-colors disabled:opacity-60";

export function HouseholdSectionForm({ household }: { household: HouseholdMemberWithLink[] }) {
  const [, completeAction, isCompleting] = useActionState(completeHouseholdSection, undefined);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base text-ink-2">Spouse or spouses, children and others who live with you.</p>

      {household.length === 0 ? (
        <p className="rounded-[14px] bg-paper-dim/70 p-4 text-base text-ink-2">
          Nobody added yet. If you live alone, there is nothing to add here, just continue below.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {household.map((entry) => (
            <HouseholdRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      <HouseholdAddForm />

      <form action={completeAction}>
        <SectionActions isPending={isCompleting} />
      </form>
    </div>
  );
}

function HouseholdRow({ entry }: { entry: HouseholdMemberWithLink }) {
  const [editing, setEditing] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, startRemoving] = useTransition();

  // Closes the edit form once the save has gone through.
  const update = async (previousState: HouseholdActionState, formData: FormData) => {
    const result = await updateOwnHouseholdMember(entry.id, previousState, formData);
    if (!result.error) setEditing(false);
    return result;
  };
  const { state, formAction, isPending, value } = useRememberedForm(update, {} as HouseholdActionState);

  function remove() {
    setRemoveError(null);
    const formData = new FormData();
    formData.set("householdMemberId", entry.id);
    startRemoving(async () => {
      try {
        await removeOwnHouseholdMember(formData);
      } catch {
        setRemoveError("That could not be removed. Check your connection and try again.");
      }
    });
  }

  const prefix = `household-${entry.id}`;

  if (editing) {
    return (
      <li className="rounded-[14px] bg-card p-4 shadow-warm">
        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Full name" id={`${prefix}-fullName`} name="fullName" required defaultValue={value("fullName", entry.fullName)} />
          <Field
            label="Age"
            id={`${prefix}-age`}
            name="age"
            type="number"
            inputMode="numeric"
            className="max-w-32"
            defaultValue={value("age", entry.age?.toString() ?? "")}
          />
          <Field
            label="Relationship"
            id={`${prefix}-relationship`}
            name="relationship"
            defaultValue={value("relationship", entry.relationship ?? "")}
          />
          <Field
            label="Their member number, if they have one"
            id={`${prefix}-linkedMemberNumber`}
            name="linkedMemberNumber"
            placeholder="AHL/M/2026/0001"
            defaultValue={value("linkedMemberNumber", entry.linkedMember?.memberNumber ?? "")}
          />
          <FormError>{state.error}</FormError>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={isPending} className={primaryButtonClass}>
              {isPending ? "Saving..." : "Save"}
            </button>
            <button type="button" disabled={isPending} className={secondaryButtonClass} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-[14px] bg-card p-4 shadow-warm">
      <div>
        <p className="text-base font-semibold">
          {entry.fullName}
          {entry.age !== null ? `, ${entry.age}` : ""}
        </p>
        {entry.relationship ? <p className="text-base text-ink-2">{entry.relationship}</p> : null}
        {entry.linkedMember?.memberNumber ? (
          <p className="text-sm text-ink-2">
            Member number <span className="font-mono">{entry.linkedMember.memberNumber}</span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${smallButtonClass} text-navy-900 hover:bg-paper-dim/60`} onClick={() => setEditing(true)}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          disabled={isRemoving}
          className={`${smallButtonClass} text-alert hover:bg-alert-soft`}
          onClick={remove}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {isRemoving ? "Removing..." : "Remove"}
        </button>
      </div>
      <FormError>{removeError}</FormError>
    </li>
  );
}

function HouseholdAddForm() {
  const { state, formAction, isPending, value, successCount } = useRememberedForm(
    addOwnHouseholdMember,
    {} as HouseholdActionState,
    (result) => !result.error,
  );

  return (
    <form
      key={successCount}
      action={formAction}
      className="flex flex-col gap-4 rounded-[14px] border-2 border-dashed border-border bg-white/60 p-4"
    >
      <p className="font-heading text-lg font-semibold text-navy-900">Add someone</p>
      <Field label="Full name" id="household-add-fullName" name="fullName" required defaultValue={value("fullName", "")} />
      <Field
        label="Age"
        id="household-add-age"
        name="age"
        type="number"
        inputMode="numeric"
        className="max-w-32"
        defaultValue={value("age", "")}
      />
      <Field label="Relationship" id="household-add-relationship" name="relationship" defaultValue={value("relationship", "")} />
      <Field
        label="Their member number, if they have one"
        id="household-add-linkedMemberNumber"
        name="linkedMemberNumber"
        placeholder="AHL/M/2026/0001"
        defaultValue={value("linkedMemberNumber", "")}
      />
      <FormError>{state.error}</FormError>
      <button type="submit" disabled={isPending} className={`${secondaryButtonClass} self-start`}>
        <UserPlus className="size-5" aria-hidden="true" />
        {isPending ? "Adding..." : "Add household member"}
      </button>
    </form>
  );
}
