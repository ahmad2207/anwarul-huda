"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ConsentActionState } from "./actions";

// The same words a member reads on section 9 of their own record, read
// aloud by the officer. The member agrees; the officer records it.
export function ConsentInPersonForm({
  action,
}: {
  action: (previous: ConsentActionState, formData: FormData) => Promise<ConsentActionState>;
}) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-md border bg-paper-dim p-4 text-sm">
        <p className="font-medium">Read this to the member</p>
        <div>
          <p className="font-medium">How you will be marked present at gatherings</p>
          <p className="text-muted-foreground">
            We keep a mathematical pattern from your face, not a photograph. The pictures never leave this phone.
          </p>
        </div>
        <div>
          <p className="font-medium">Used only to mark you present</p>
          <p className="text-muted-foreground">You can remove it any time, and you can always be checked in by name.</p>
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agreed" className="mt-1" />
        The member has heard this and agrees
      </label>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : "Continue to the camera"}
      </Button>
    </form>
  );
}
