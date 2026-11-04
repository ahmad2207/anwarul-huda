"use client";

import { CheckboxRow, FormError, SectionActions } from "@/components/member/form";
import { useRememberedForm } from "@/components/member/use-remembered-form";
import { saveConsentSection } from "./actions";

// Separate from section 9's consentBiometric (MEMBER-INTERFACE.md 3.4:
// biometric data is not covered by a general records consent), which is
// why that checkbox does not appear on this screen at all.
export function ConsentSectionForm({
  consentRecords,
  consentDirectory,
  consentComms,
}: {
  consentRecords: boolean;
  consentDirectory: boolean;
  consentComms: boolean;
}) {
  const { state: error, formAction, isPending, checked } = useRememberedForm(saveConsentSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Your consent</legend>
        <CheckboxRow name="consentRecords" defaultChecked={checked("consentRecords", consentRecords)}>
          I consent to my record being kept
        </CheckboxRow>
        <CheckboxRow name="consentDirectory" defaultChecked={checked("consentDirectory", consentDirectory)}>
          I consent to being listed in the members directory
        </CheckboxRow>
        <CheckboxRow name="consentComms" defaultChecked={checked("consentComms", consentComms)}>
          I consent to receiving communications
        </CheckboxRow>
      </fieldset>

      <FormError>{error}</FormError>
      <SectionActions isPending={isPending} />
    </form>
  );
}
