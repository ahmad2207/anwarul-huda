"use client";

import { useActionState } from "react";
import { CheckboxRow, FormError, primaryButtonClass, secondaryButtonClass } from "@/components/member/form";
import { setUpFaceEnrolment, deferFaceEnrolment } from "./actions";

export function FaceSectionForm({ consentBiometric }: { consentBiometric: boolean }) {
  const [setupError, setupAction, isSettingUp] = useActionState(setUpFaceEnrolment, undefined);
  const [, deferAction, isDeferring] = useActionState(deferFaceEnrolment, undefined);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base text-ink-2">How you will be marked present at gatherings.</p>

      <div className="flex flex-col gap-4 rounded-[14px] bg-card p-5 shadow-warm">
        <div>
          <p className="font-heading text-lg font-semibold text-navy-900">What we keep</p>
          <p className="text-base text-ink-2">
            A mathematical pattern from your face, not a photograph. The pictures never leave your phone.
          </p>
        </div>
        <div>
          <p className="font-heading text-lg font-semibold text-navy-900">Used only to mark you present</p>
          <p className="text-base text-ink-2">You can remove it any time.</p>
        </div>
      </div>

      {/* Its own form: consent belongs to setting up, not to deferring
          (MEMBER-INTERFACE.md 3.4, "the second button is not a
          decline"), so the checkbox has to submit with "Set up now"
          only, never with "I cannot do this now". */}
      <form action={setupAction} className="flex flex-col gap-4">
        <CheckboxRow name="consented" defaultChecked={consentBiometric}>
          I agree to this
        </CheckboxRow>
        <FormError>{setupError}</FormError>
        <button type="submit" disabled={isSettingUp || isDeferring} className={primaryButtonClass}>
          {isSettingUp ? "Saving..." : "Set up now"}
        </button>
      </form>

      <form action={deferAction}>
        <button type="submit" disabled={isSettingUp || isDeferring} className={`${secondaryButtonClass} w-full`}>
          {isDeferring ? "Saving..." : "I cannot do this now"}
        </button>
      </form>
    </div>
  );
}
