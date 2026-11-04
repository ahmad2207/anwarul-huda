"use client";

import { Field, FormError, SectionActions } from "@/components/member/form";
import { useRememberedForm } from "@/components/member/use-remembered-form";
import { saveNextOfKinSection } from "./actions";

export function NextOfKinSectionForm({
  nokName,
  nokRelationship,
  nokPhone,
  nokAltPhone,
}: {
  nokName: string | null;
  nokRelationship: string | null;
  nokPhone: string | null;
  nokAltPhone: string | null;
}) {
  const { state: error, formAction, isPending, value } = useRememberedForm(saveNextOfKinSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="Name" id="nokName" defaultValue={value("nokName", nokName ?? "")} />
      <Field label="Relationship" id="nokRelationship" defaultValue={value("nokRelationship", nokRelationship ?? "")} />
      <Field label="Phone" id="nokPhone" type="tel" defaultValue={value("nokPhone", nokPhone ?? "")} />
      <Field label="Alternative phone" id="nokAltPhone" type="tel" defaultValue={value("nokAltPhone", nokAltPhone ?? "")} />

      <FormError>{error}</FormError>
      <SectionActions isPending={isPending} />
    </form>
  );
}
