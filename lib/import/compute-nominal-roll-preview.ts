import type { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateNominalRollRow } from "./validate-nominal-roll-row";
import type { ValidatedNominalRollRow } from "./validate-nominal-roll-row";
import type { StagedImportData } from "./compute-preview";

export interface NominalRollPreviewGroups {
  clean: ValidatedNominalRollRow[];
  fail: ValidatedNominalRollRow[];
}

/**
 * The nominal roll equivalent of computePreview: loads reference data,
 * then validates every staged row against it. There is no "warning"
 * bucket here (nothing in this mode is optional enough to warn about
 * rather than require) and no phone-based duplicate lookup (a nominal
 * roll member has no phone to look up by; its own duplicate detection is
 * the resolved S/N cross-reference, built after commit).
 */
export async function computeNominalRollPreview(
  staging: StagedImportData,
  mapping: Record<string, string | null>,
  actor: { roles: RoleName[]; wingIds: string[] },
): Promise<NominalRollPreviewGroups> {
  const wings = await prisma.wing.findMany();

  const groups: NominalRollPreviewGroups = { clean: [], fail: [] };

  staging.rows.forEach((raw, index) => {
    const mapped: Record<string, string> = {};
    for (const key of Object.keys(mapping)) {
      const header = mapping[key];
      mapped[key] = header ? (raw[header] ?? "").trim() : "";
    }
    const result = validateNominalRollRow(index + 1, raw, mapped, { wings, actor });
    // validateNominalRollRow only ever classifies "fail" or "clean" (this
    // mode has no warning tier), but its return type still shares
    // RowClassification with the full import, which does have one. Branch
    // explicitly rather than indexing by classification, so a stray
    // "warning" is a compile error here instead of a silently dropped row.
    if (result.classification === "fail") {
      groups.fail.push(result);
    } else {
      groups.clean.push(result);
    }
  });

  return groups;
}
