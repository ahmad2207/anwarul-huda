"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { runRetrospectiveScanAction, type FaceMatchActionState } from "./actions";

export function ScanButton() {
  const [state, formAction, isPending] = useActionState<FaceMatchActionState>(runRetrospectiveScanAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" variant="outline" disabled={isPending} className="self-start">
        {isPending ? "Scanning..." : "Scan all enrolled faces"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
    </form>
  );
}
