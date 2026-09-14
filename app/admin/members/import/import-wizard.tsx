"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IMPORT_FIELDS } from "@/lib/import/system-fields";
import { commitImport, previewImport, rollbackImportAction, uploadImportFile } from "./actions";
import type { CommitOutcome, DuplicateAction } from "@/lib/import/commit-import";
import type { PreviewGroups } from "./actions";
import type { ValidatedImportRow } from "@/lib/import/validate-row";

type Step = "upload" | "mapping" | "preview" | "done";

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [batchId, setBatchId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [groups, setGroups] = useState<PreviewGroups | null>(null);
  const [duplicateActions, setDuplicateActions] = useState<Record<number, DuplicateAction>>({});
  const [outcome, setOutcome] = useState<CommitOutcome | null>(null);
  const [rolledBack, setRolledBack] = useState(false);

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadImportFile(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setBatchId(result.batchId ?? null);
      setHeaders(result.headers ?? []);
      setRowCount(result.rowCount ?? 0);
      setMapping(result.guessedMapping ?? {});
      setStep("mapping");
    });
  }

  function handlePreview() {
    if (!batchId) return;
    setError(null);
    startTransition(async () => {
      const result = await previewImport(batchId, mapping);
      if (result.error) {
        setError(result.error);
        return;
      }
      setGroups(result.groups ?? null);
      setStep("preview");
    });
  }

  function handleCommit() {
    if (!batchId) return;
    setError(null);
    startTransition(async () => {
      const result = await commitImport(batchId, duplicateActions);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOutcome(result.outcome ?? null);
      setStep("done");
    });
  }

  function handleRollback() {
    if (!batchId) return;
    setError(null);
    startTransition(async () => {
      const result = await rollbackImportAction(batchId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.blockers && result.blockers.length > 0) {
        setError(
          `Cannot roll back: ${result.blockers
            .map((b) => `${b.surname} ${b.firstName} (${b.reason})`)
            .join(", ")} already ${result.blockers.length === 1 ? "has" : "have"} activity recorded.`,
        );
        return;
      }
      setRolledBack(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Steps current={step} />

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {step === "upload" ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload a CSV file</CardTitle>
            <CardDescription>
              Up to 5,000 rows.{" "}
              <Link href="/admin/members/import/template" className="underline underline-offset-4">
                Download the template
              </Link>{" "}
              if you have not already.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleUpload} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="file" className="text-xs">
                  CSV file
                </Label>
                <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
              </div>
              <Button type="submit" disabled={isPending} className="self-start">
                {isPending ? "Reading file..." : "Upload"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === "mapping" ? (
        <Card>
          <CardHeader>
            <CardTitle>Map columns</CardTitle>
            <CardDescription>
              {rowCount} row{rowCount === 1 ? "" : "s"} found. Confirm which column in your file is which
              system field.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1">
                  <Label className="text-xs">
                    {field.label}
                    {field.required ? " *" : ""}
                  </Label>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [field.key]: event.target.value || null,
                      }))
                    }
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Not mapped</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                  {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
                </div>
              ))}
            </div>
            <div>
              <Button onClick={handlePreview} disabled={isPending}>
                {isPending ? "Validating..." : "Validate and preview"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "preview" && groups ? (
        <PreviewGroupsView
          groups={groups}
          duplicateActions={duplicateActions}
          onDuplicateActionChange={(rowNumber, action) =>
            setDuplicateActions((current) => ({ ...current, [rowNumber]: action }))
          }
          onBack={() => setStep("mapping")}
          onCommit={handleCommit}
          isPending={isPending}
        />
      ) : null}

      {step === "done" && outcome ? (
        <Card>
          <CardHeader>
            <CardTitle>Import complete</CardTitle>
            <CardDescription>
              {outcome.created} created, {outcome.updated} updated, {outcome.skipped} skipped,{" "}
              {outcome.failed} failed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {rolledBack ? (
              <p className="text-sm text-muted-foreground">This import has been rolled back.</p>
            ) : (
              <Button type="button" variant="outline" onClick={handleRollback} disabled={isPending}>
                {isPending ? "Rolling back..." : "Roll back this import"}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: "upload", label: "1. Upload" },
    { key: "mapping", label: "2. Map columns" },
    { key: "preview", label: "3. Preview" },
    { key: "done", label: "4. Done" },
  ];
  return (
    <div className="flex gap-4 text-sm">
      {steps.map((step) => (
        <span
          key={step.key}
          className={step.key === current ? "font-semibold" : "text-muted-foreground"}
        >
          {step.label}
        </span>
      ))}
    </div>
  );
}

function PreviewGroupsView({
  groups,
  duplicateActions,
  onDuplicateActionChange,
  onBack,
  onCommit,
  isPending,
}: {
  groups: PreviewGroups;
  duplicateActions: Record<number, DuplicateAction>;
  onDuplicateActionChange: (rowNumber: number, action: DuplicateAction) => void;
  onBack: () => void;
  onCommit: () => void;
  isPending: boolean;
}) {
  const willImport = groups.clean.length + groups.warning.length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            {groups.clean.length} clean, {groups.warning.length} with warnings, {groups.fail.length} will
            fail. Nothing has been written to the member register yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Back to column mapping
          </Button>
          <Button type="button" onClick={onCommit} disabled={isPending || willImport === 0}>
            {isPending ? "Importing..." : `Confirm import (${willImport} row${willImport === 1 ? "" : "s"})`}
          </Button>
        </CardContent>
      </Card>

      <RowGroup title="Will fail" tone="destructive" rows={groups.fail} />
      <RowGroup
        title="Will import with warnings"
        tone="warning"
        rows={groups.warning}
        duplicateActions={duplicateActions}
        onDuplicateActionChange={onDuplicateActionChange}
      />
      <RowGroup
        title="Will import cleanly"
        tone="clean"
        rows={groups.clean}
        duplicateActions={duplicateActions}
        onDuplicateActionChange={onDuplicateActionChange}
      />
    </div>
  );
}

function RowGroup({
  title,
  tone,
  rows,
  duplicateActions = {},
  onDuplicateActionChange,
}: {
  title: string;
  tone: "clean" | "warning" | "destructive";
  rows: ValidatedImportRow[];
  duplicateActions?: Record<number, DuplicateAction>;
  onDuplicateActionChange?: (rowNumber: number, action: DuplicateAction) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          {title} ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.slice(0, 50).map((row) => (
          <div key={row.rowNumber} className="rounded-md border p-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                Row {row.rowNumber}: {row.raw[Object.keys(row.raw)[0]] ?? ""}
              </span>
              {row.duplicate && onDuplicateActionChange ? (
                <div className="flex items-center gap-2">
                  <span
                    className={
                      tone === "destructive"
                        ? "text-xs text-destructive"
                        : "text-xs text-amber-700 dark:text-amber-400"
                    }
                  >
                    Possible duplicate of {row.duplicate.surname} {row.duplicate.firstName} (
                    {row.duplicate.memberNumber ?? "pending"})
                  </span>
                  <select
                    value={duplicateActions[row.rowNumber] ?? "skip"}
                    onChange={(event) =>
                      onDuplicateActionChange(row.rowNumber, event.target.value as DuplicateAction)
                    }
                    className="h-7 rounded-md border border-input bg-background px-1 text-xs"
                  >
                    <option value="skip">Skip</option>
                    <option value="update">Update existing</option>
                    <option value="create">Create anyway</option>
                  </select>
                </div>
              ) : null}
            </div>
            {row.issues.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-0.5">
                {row.issues.map((issue, index) => (
                  <li
                    key={index}
                    className={
                      issue.severity === "error"
                        ? "text-xs text-destructive"
                        : "text-xs text-amber-700 dark:text-amber-400"
                    }
                  >
                    {issue.field}: {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {rows.length > 50 ? (
          <p className="text-xs text-muted-foreground">And {rows.length - 50} more.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
