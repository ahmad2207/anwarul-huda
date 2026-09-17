import type { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeNigerianPhone } from "@/lib/phone";
import { applyColumnMapping, validateImportRow } from "./validate-row";
import type { ValidatedImportRow } from "./validate-row";

export interface PreviewGroups {
  clean: ValidatedImportRow[];
  warning: ValidatedImportRow[];
  fail: ValidatedImportRow[];
}

export interface StagedImportData {
  headers: string[];
  rows: Array<Record<string, string>>;
  /** Present once the mapping step has been confirmed at least once. */
  mapping?: Record<string, string | null>;
}

/**
 * The database touching half of building a preview: load the reference
 * data (wings, branches, service areas, and which of the uploaded phone
 * numbers already belong to an existing member), then validate every
 * staged row against it. Kept separate from the "use server" action in
 * app/admin/members/import/actions.ts, which only adds the auth check, so
 * this can be exercised directly in a test with a plain actor object
 * instead of a real session.
 */
export async function computePreview(
  staging: StagedImportData,
  mapping: Record<string, string | null>,
  actor: { roles: RoleName[]; wingIds: string[] },
): Promise<PreviewGroups> {
  const [wings, branches, serviceAreas] = await Promise.all([
    prisma.wing.findMany(),
    prisma.branch.findMany(),
    prisma.serviceArea.findMany(),
  ]);

  // Member.phone is always stored normalised (E.164), so the lookup has to
  // normalise each row's phone the same way before querying, not query with
  // whatever raw text is in the CSV, which would silently never match.
  const normalizedPhones = new Set<string>();
  for (const row of staging.rows) {
    const rawPhone = applyColumnMapping(row, mapping).phone;
    if (!rawPhone) continue;
    try {
      normalizedPhones.add(normalizeNigerianPhone(rawPhone));
    } catch {
      // Not a recognisable phone number at all; validateImportRow reports
      // this as its own row error, nothing to look up here.
    }
  }

  const existingMembers =
    normalizedPhones.size > 0
      ? await prisma.member.findMany({
          where: { phone: { in: Array.from(normalizedPhones) } },
          select: { id: true, memberNumber: true, surname: true, firstName: true, phone: true },
        })
      : [];
  // Non-null: the query above only ever matches a row whose phone is in
  // normalizedPhones, a set of real, non-empty strings, so a matched
  // member's phone can never be null here.
  const existingByPhone = new Map(
    existingMembers.map((member) => [member.phone!, { ...member, phone: member.phone! }]),
  );

  const groups: PreviewGroups = { clean: [], warning: [], fail: [] };

  staging.rows.forEach((raw, index) => {
    const mapped = applyColumnMapping(raw, mapping);
    const result = validateImportRow(index + 1, raw, mapped, {
      wings,
      branches,
      serviceAreas,
      existingByPhone,
      actor,
    });
    groups[result.classification].push(result);
  });

  return groups;
}
