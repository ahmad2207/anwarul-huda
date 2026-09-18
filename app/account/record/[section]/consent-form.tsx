"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
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
  const [error, formAction, isPending] = useActionState(saveConsentSection, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex items-start gap-3 text-base">
        <input
          type="checkbox"
          name="consentRecords"
          defaultChecked={consentRecords}
          className="mt-1 size-5 shrink-0"
        />
        I consent to my record being kept
      </label>
      <label className="flex items-start gap-3 text-base">
        <input
          type="checkbox"
          name="consentDirectory"
          defaultChecked={consentDirectory}
          className="mt-1 size-5 shrink-0"
        />
        I consent to being listed in the members directory
      </label>
      <label className="flex items-start gap-3 text-base">
        <input type="checkbox" name="consentComms" defaultChecked={consentComms} className="mt-1 size-5 shrink-0" />
        I consent to receiving communications
      </label>

      {error ? <p className="text-base text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isPending} className="h-11 self-start rounded-[4px] px-6 text-base">
        {isPending ? "Saving..." : "Save and continue"}
      </Button>
    </form>
  );
}
