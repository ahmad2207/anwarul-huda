"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { setUpFaceEnrolment, deferFaceEnrolment } from "./actions";

export function FaceSectionForm({ consentBiometric }: { consentBiometric: boolean }) {
  const [setupError, setupAction, isSettingUp] = useActionState(setUpFaceEnrolment, undefined);
  const [, deferAction, isDeferring] = useActionState(deferFaceEnrolment, undefined);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base text-muted-foreground">How you will be marked present at gatherings.</p>

      <div className="flex flex-col gap-3 rounded-[4px] border border-border bg-paper-dim p-4">
        <div>
          <p className="text-base font-medium">What we keep</p>
          <p className="text-base text-muted-foreground">
            A mathematical pattern from your face, not a photograph. The pictures never leave your phone.
          </p>
        </div>
        <div>
          <p className="text-base font-medium">Used only to mark you present</p>
          <p className="text-base text-muted-foreground">You can remove it any time.</p>
        </div>
      </div>

      {/* Its own form: consent belongs to setting up, not to deferring
          (MEMBER-INTERFACE.md 3.4, "the second button is not a
          decline"), so the checkbox has to submit with "Set up now"
          only, never with "I cannot do this now". */}
      <form action={setupAction} className="flex flex-col gap-4">
        <label className="flex items-start gap-3 text-base">
          <input
            type="checkbox"
            name="consented"
            defaultChecked={consentBiometric}
            className="mt-1 size-5 shrink-0"
          />
          I agree to this
        </label>
        {setupError ? <p className="text-base text-destructive">{setupError}</p> : null}
        <Button type="submit" disabled={isSettingUp || isDeferring} className="h-11 rounded-[4px] px-6 text-base">
          {isSettingUp ? "Saving..." : "Set up now"}
        </Button>
      </form>

      <form action={deferAction}>
        <Button
          type="submit"
          variant="outline"
          disabled={isSettingUp || isDeferring}
          className="h-11 w-full rounded-[4px] px-6 text-base"
        >
          {isDeferring ? "Saving..." : "I cannot do this now"}
        </Button>
      </form>
    </div>
  );
}
