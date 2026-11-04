"use client";

import { Field, FormError, SectionActions, SelectField } from "@/components/member/form";
import { useRememberedForm } from "@/components/member/use-remembered-form";
import { saveAboutSection } from "./actions";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function AboutSectionForm({
  dateOfBirth,
  gender,
  maritalStatus,
  occupation,
  nationality,
  stateOfOrigin,
  languages,
}: {
  dateOfBirth: Date | null;
  gender: string;
  maritalStatus: string | null;
  occupation: string | null;
  nationality: string | null;
  stateOfOrigin: string | null;
  languages: string[];
}) {
  const { state: error, formAction, isPending, value } = useRememberedForm(saveAboutSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field
        label="Date of birth"
        id="dateOfBirth"
        type="date"
        defaultValue={value("dateOfBirth", toDateInputValue(dateOfBirth))}
      />
      <SelectField
        label="Gender"
        id="gender"
        required
        defaultValue={value("gender", gender)}
        options={[
          { value: "MALE", label: "Male" },
          { value: "FEMALE", label: "Female" },
        ]}
      />
      <SelectField
        label="Marital status"
        id="maritalStatus"
        placeholder="Not stated"
        defaultValue={value("maritalStatus", maritalStatus ?? "")}
        options={[
          { value: "SINGLE", label: "Single" },
          { value: "MARRIED", label: "Married" },
          { value: "DIVORCED", label: "Divorced" },
          { value: "WIDOWED", label: "Widowed" },
        ]}
      />
      <Field label="Occupation" id="occupation" defaultValue={value("occupation", occupation ?? "")} />
      <Field label="Nationality" id="nationality" defaultValue={value("nationality", nationality ?? "")} />
      <Field label="State of origin" id="stateOfOrigin" defaultValue={value("stateOfOrigin", stateOfOrigin ?? "")} />
      <Field
        label="Languages spoken"
        id="languages"
        placeholder="Yoruba, English"
        hint="Separate more than one with a comma."
        defaultValue={value("languages", languages.join(", "))}
      />

      <FormError>{error}</FormError>
      <SectionActions isPending={isPending} />
    </form>
  );
}
