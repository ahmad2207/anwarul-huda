"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { closeGathering } from "./actions";

export function CloseGatheringButton({ gatheringId }: { gatheringId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              await closeGathering(gatheringId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Something went wrong.");
            }
          })
        }
      >
        {isPending ? "Closing..." : "Close"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
