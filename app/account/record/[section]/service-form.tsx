"use client";

import type { ServiceArea } from "@prisma/client";
import { CheckboxRow, Field, FormError, SectionActions } from "@/components/member/form";
import { useRememberedForm } from "@/components/member/use-remembered-form";
import { saveServiceSection } from "./actions";

export function ServiceSectionForm({
  islamicEducation,
  otherSkills,
  availability,
  serviceAreas,
  selectedServiceAreaIds,
}: {
  islamicEducation: string | null;
  otherSkills: string | null;
  availability: string[];
  serviceAreas: ServiceArea[];
  selectedServiceAreaIds: Set<string>;
}) {
  const { state: error, formAction, isPending, value, checkedValue } = useRememberedForm(
    saveServiceSection,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field
        label="Islamic education or qualifications"
        id="islamicEducation"
        defaultValue={value("islamicEducation", islamicEducation ?? "")}
      />
      <Field label="Other skills" id="otherSkills" defaultValue={value("otherSkills", otherSkills ?? "")} />
      <Field
        label="General availability"
        id="availability"
        placeholder="Weekday evenings, Sunday"
        hint="Separate more than one with a comma."
        defaultValue={value("availability", availability.join(", "))}
      />

      {serviceAreas.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-base font-medium">Areas of service</legend>
          {serviceAreas.map((area) => (
            <CheckboxRow
              key={area.id}
              name="serviceAreaIds"
              value={area.id}
              defaultChecked={checkedValue("serviceAreaIds", area.id, selectedServiceAreaIds.has(area.id))}
            >
              {area.name}
            </CheckboxRow>
          ))}
        </fieldset>
      ) : null}

      <FormError>{error}</FormError>
      <SectionActions isPending={isPending} />
    </form>
  );
}
