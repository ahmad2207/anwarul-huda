"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { CsvParseError, parseCsvFile } from "@/lib/import/parse-csv";
import { guessColumnMapping } from "@/lib/import/system-fields";
import { computePreview } from "@/lib/import/compute-preview";
import type { PreviewGroups, StagedImportData } from "@/lib/import/compute-preview";
import { commitImportRows } from "@/lib/import/commit-import";
import type { CommitOutcome, DuplicateAction } from "@/lib/import/commit-import";
import { rollbackImportBatch } from "@/lib/import/rollback-import";
import type { RollbackBlocker } from "@/lib/import/rollback-import";

export type { PreviewGroups };

export interface UploadResult {
  error?: string;
  batchId?: string;
  headers?: string[];
  guessedMapping?: Record<string, string | null>;
  rowCount?: number;
}

export async function uploadImportFile(formData: FormData): Promise<UploadResult> {
  const actor = await requireRole(["WING_ADMIN"]);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file first." };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { error: "Only .csv files are accepted." };
  }

  let parsed;
  try {
    parsed = await parseCsvFile(file);
  } catch (error) {
    if (error instanceof CsvParseError) {
      return { error: error.message };
    }
    return { error: "Could not read this file. Check it is a valid CSV export." };
  }

  const guessedMapping = guessColumnMapping(parsed.headers);

  const batch = await prisma.importBatch.create({
    data: {
      fileName: file.name,
      rowCount: parsed.rows.length,
      status: "PENDING",
      uploadedById: actor.id,
      stagingData: {
        headers: parsed.headers,
        rows: parsed.rows,
      },
    },
  });

  return {
    batchId: batch.id,
    headers: parsed.headers,
    guessedMapping,
    rowCount: parsed.rows.length,
  };
}

async function loadOwnedBatch(batchId: string, actor: { id: string; roles: string[] }) {
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return { error: "This import batch no longer exists." } as const;
  }
  if (batch.uploadedById !== actor.id && !actor.roles.includes("SUPER_ADMIN")) {
    return { error: "You do not have access to this import batch." } as const;
  }
  return { batch } as const;
}

export interface PreviewResult {
  error?: string;
  groups?: PreviewGroups;
}

export async function previewImport(
  batchId: string,
  mapping: Record<string, string | null>,
): Promise<PreviewResult> {
  const actor = await requireRole(["WING_ADMIN"]);

  const loaded = await loadOwnedBatch(batchId, actor);
  if (loaded.error) return { error: loaded.error };
  const { batch } = loaded;

  if (batch.status === "COMMITTED" || batch.status === "ROLLED_BACK") {
    return { error: "This batch has already been decided and cannot be previewed again." };
  }

  const staging = batch.stagingData as StagedImportData | null;
  if (!staging) {
    return { error: "This import batch has no staged data." };
  }

  const groups = await computePreview(staging, mapping, actor);

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: "PREVIEWED",
      successCount: groups.clean.length + groups.warning.length,
      errorCount: groups.fail.length,
      stagingData: {
        headers: staging.headers,
        rows: staging.rows,
        mapping,
      },
    },
  });

  return { groups };
}

export interface CommitResult {
  error?: string;
  outcome?: CommitOutcome;
}

export async function commitImport(
  batchId: string,
  duplicateActions: Record<number, DuplicateAction>,
): Promise<CommitResult> {
  const actor = await requireRole(["WING_ADMIN"]);

  const loaded = await loadOwnedBatch(batchId, actor);
  if (loaded.error) return { error: loaded.error };
  const { batch } = loaded;

  if (batch.status !== "PREVIEWED") {
    return { error: "Preview this batch before committing it." };
  }

  const staging = batch.stagingData as StagedImportData | null;
  if (!staging || !staging.mapping) {
    return { error: "This import batch has no confirmed column mapping." };
  }

  // Re-validated fresh from the staged rows and the confirmed mapping,
  // rather than trusting whatever preview the client happens to be
  // holding: the commit has to reflect the same rules the preview did,
  // not whatever the browser last rendered.
  const groups = await computePreview(staging, staging.mapping, actor);
  const wings = await prisma.wing.findMany({ select: { id: true, numberLetter: true } });

  const outcome = await prisma.$transaction(async (tx) => {
    const result = await commitImportRows(tx, batch.id, groups, duplicateActions, actor.id, wings);

    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMMITTED",
        committedAt: new Date(),
        successCount: result.created + result.updated,
        errorCount: result.failed,
        // No longer needed once committed: what happened is in
        // errorReport now, and rollback finds this batch's members
        // through Member.importBatchId, not through this.
        stagingData: Prisma.DbNull,
        errorReport: JSON.parse(
          JSON.stringify({
            failedRows: groups.fail.map((row) => ({ rowNumber: row.rowNumber, issues: row.issues })),
            skipped: result.skipped,
          }),
        ) as Prisma.InputJsonValue,
      },
    });

    return result;
  });

  await writeAudit({
    actorId: actor.id,
    action: "import.committed",
    entity: "ImportBatch",
    entityId: batch.id,
    before: { status: batch.status },
    after: { status: "COMMITTED", ...outcome },
  });

  revalidatePath("/admin/members/import");
  return { outcome };
}

export interface DiscardResult {
  error?: string;
}

export async function discardImport(batchId: string): Promise<DiscardResult> {
  const actor = await requireRole(["WING_ADMIN"]);

  const loaded = await loadOwnedBatch(batchId, actor);
  if (loaded.error) return { error: loaded.error };
  const { batch } = loaded;

  if (batch.status === "COMMITTED") {
    return { error: "This batch has already been committed. Roll it back instead of discarding it." };
  }
  if (batch.status === "ROLLED_BACK") {
    return { error: "This batch has already been discarded." };
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: "ROLLED_BACK", stagingData: Prisma.DbNull },
  });

  await writeAudit({
    actorId: actor.id,
    action: "import.discarded",
    entity: "ImportBatch",
    entityId: batch.id,
    before: { status: batch.status },
    after: { status: "ROLLED_BACK" },
  });

  revalidatePath("/admin/members/import");
  return {};
}

export interface RollbackResultForUi {
  error?: string;
  blockers?: RollbackBlocker[];
  deactivatedCount?: number;
}

export async function rollbackImportAction(batchId: string): Promise<RollbackResultForUi> {
  const actor = await requireRole(["WING_ADMIN"]);

  const loaded = await loadOwnedBatch(batchId, actor);
  if (loaded.error) return { error: loaded.error };
  const { batch } = loaded;

  if (batch.status !== "COMMITTED") {
    return { error: "Only a committed batch can be rolled back." };
  }

  const result = await prisma.$transaction((tx) => rollbackImportBatch(tx, batch.id, actor.id));

  if (result.blockers && result.blockers.length > 0) {
    return { blockers: result.blockers };
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: "ROLLED_BACK" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "import.rolled_back",
    entity: "ImportBatch",
    entityId: batch.id,
    before: { status: batch.status },
    after: { status: "ROLLED_BACK", deactivatedCount: result.deactivatedCount },
  });

  revalidatePath("/admin/members/import");
  return { deactivatedCount: result.deactivatedCount };
}
