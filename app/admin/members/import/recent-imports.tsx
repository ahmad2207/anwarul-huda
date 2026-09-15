"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { discardImport, rollbackImportAction } from "./actions";

export interface RecentImportBatch {
  id: string;
  fileName: string;
  status: string;
  rowCount: number;
  successCount: number;
  errorCount: number;
  createdAt: string;
  uploadedByLabel: string;
}

export function RecentImports({ batches }: { batches: RecentImportBatch[] }) {
  if (batches.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Recent imports</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {batches.map((batch) => (
          <BatchRow key={batch.id} batch={batch} />
        ))}
      </CardContent>
    </Card>
  );
}

function BatchRow({ batch }: { batch: RecentImportBatch }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState(batch.status);

  function handleDiscard() {
    setMessage(null);
    startTransition(async () => {
      const result = await discardImport(batch.id);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setStatus("ROLLED_BACK");
      setMessage("Discarded.");
    });
  }

  function handleRollback() {
    setMessage(null);
    startTransition(async () => {
      const result = await rollbackImportAction(batch.id);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      if (result.blockers && result.blockers.length > 0) {
        setMessage(
          `Cannot roll back: ${result.blockers
            .map((b) => `${b.surname} ${b.firstName} (${b.reason})`)
            .join(", ")} already ${result.blockers.length === 1 ? "has" : "have"} activity recorded.`,
        );
        return;
      }
      setStatus("ROLLED_BACK");
      setMessage(`Rolled back. ${result.deactivatedCount ?? 0} member(s) set to inactive.`);
    });
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border p-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {batch.fileName} &middot; {batch.rowCount} rows &middot; {statusLabel(status)} &middot;{" "}
          {batch.uploadedByLabel} &middot; {batch.createdAt}
        </span>
        <div className="flex gap-2">
          {(status === "PENDING" || status === "PREVIEWED") && (
            <Button type="button" size="sm" variant="outline" onClick={handleDiscard} disabled={isPending}>
              Discard
            </Button>
          )}
          {status === "COMMITTED" && (
            <Button type="button" size="sm" variant="outline" onClick={handleRollback} disabled={isPending}>
              Roll back
            </Button>
          )}
        </div>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Uploaded, not yet mapped";
    case "PREVIEWED":
      return "Previewed, not yet confirmed";
    case "COMMITTED":
      return "Committed";
    case "ROLLED_BACK":
      return "Discarded or rolled back";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}
