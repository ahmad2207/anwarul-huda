import type { Prisma } from "@prisma/client";
import { writeAuditMany } from "@/lib/audit";
import { generateMemberNumber } from "@/lib/member-number";
import type { PreviewGroups } from "./compute-preview";
import type { ParsedMemberData, ValidatedImportRow } from "./validate-row";

export type DuplicateAction = "skip" | "update" | "create";

export interface CommitOutcome {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface WingLetterRef {
  id: string;
  numberLetter: string;
}

/**
 * Writes every clean and warning row to the member register, inside the
 * caller's transaction. Failing rows are never written. A row flagged as a
 * likely duplicate follows the caller's chosen action for that row
 * (skip it, update the existing member, or create a new one anyway),
 * defaulting to skip, the safest choice, if none was given. Every newly
 * created member is issued a member number the same way approval does
 * (lib/member-number.ts), safe under concurrency for the same reason.
 */
export async function commitImportRows(
  tx: Prisma.TransactionClient,
  batchId: string,
  groups: PreviewGroups,
  duplicateActions: Record<number, DuplicateAction>,
  actorId: string,
  wings: WingLetterRef[],
): Promise<CommitOutcome> {
  const outcome: CommitOutcome = { created: 0, updated: 0, skipped: 0, failed: groups.fail.length };
  const auditEntries: Parameters<typeof writeAuditMany>[0] = [];
  const wingLetterById = new Map(wings.map((wing) => [wing.id, wing.numberLetter]));

  for (const row of [...groups.clean, ...groups.warning]) {
    if (!row.data) continue; // cannot happen: only fail rows have null data

    const action: DuplicateAction = row.duplicate
      ? (duplicateActions[row.rowNumber] ?? "skip")
      : "create";

    if (action === "skip") {
      outcome.skipped += 1;
      continue;
    }

    if (action === "update" && row.duplicate) {
      const before = await tx.member.findUnique({ where: { id: row.duplicate.id } });
      const updated = await tx.member.update({
        where: { id: row.duplicate.id },
        data: updateData(row.data),
      });
      outcome.updated += 1;
      auditEntries.push({
        actorId,
        action: "member.updated_via_import",
        entity: "Member",
        entityId: row.duplicate.id,
        before,
        after: updated,
      });
      continue;
    }

    const wingNumberLetter = wingLetterById.get(row.data.wingId);
    if (!wingNumberLetter) {
      // Cannot happen: validateImportRow already refused any row whose
      // wing does not resolve to a known wing. Guarded anyway, so a
      // future change to that rule cannot silently issue a malformed
      // member number here.
      outcome.failed += 1;
      continue;
    }
    const memberNumber = await generateMemberNumber(tx, {
      wingId: row.data.wingId,
      wingNumberLetter,
    });

    const created = await tx.member.create({ data: createData(row, batchId, memberNumber) });
    outcome.created += 1;
    auditEntries.push({
      actorId,
      action: "member.imported",
      entity: "Member",
      entityId: created.id,
      before: null,
      after: created,
    });
  }

  await writeAuditMany(auditEntries, tx);

  return outcome;
}

function createData(row: ValidatedImportRow, batchId: string, memberNumber: string): Prisma.MemberCreateInput {
  const data = row.data!;
  return {
    memberNumber,
    title: data.title,
    surname: data.surname,
    firstName: data.firstName,
    otherNames: data.otherNames,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    maritalStatus: data.maritalStatus,
    occupation: data.occupation,
    nationality: data.nationality,
    stateOfOrigin: data.stateOfOrigin,
    languages: data.languages,
    phone: data.phone,
    altPhone: data.altPhone,
    email: data.email,
    address: data.address,
    city: data.city,
    state: data.state,
    landmark: data.landmark,
    preferredContact: data.preferredContact,
    wing: { connect: { id: data.wingId } },
    branch: data.branchId ? { connect: { id: data.branchId } } : undefined,
    yearJoined: data.yearJoined,
    officeHeld: data.officeHeld,
    halaqah: data.halaqah,
    islamicEducation: data.islamicEducation,
    otherSkills: data.otherSkills,
    availability: data.availability,
    notes: data.notes,
    accessNeeds: data.accessNeeds,
    nokName: data.nokName,
    nokRelationship: data.nokRelationship,
    nokPhone: data.nokPhone,
    nokAltPhone: data.nokAltPhone,
    consentRecords: data.consentRecords,
    consentDirectory: data.consentDirectory,
    consentComms: data.consentComms,
    consentBiometric: data.consentBiometric,
    status: "ACTIVE",
    source: "CSV_IMPORT",
    importBatch: { connect: { id: batchId } },
    serviceAreas: { create: data.serviceAreaIds.map((serviceAreaId) => ({ serviceAreaId })) },
  };
}

// Deliberately excludes wingId, memberNumber, status, source and the
// approval fields. Re-assigning an existing member's wing through a bulk
// import update carries the same risk as doing it from the edit form (see
// app/admin/members/[id]/schema.ts): it can silently desynchronise an
// already-issued member number from the wing it names.
function updateData(data: ParsedMemberData): Prisma.MemberUpdateInput {
  return {
    title: data.title,
    surname: data.surname,
    firstName: data.firstName,
    otherNames: data.otherNames,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    maritalStatus: data.maritalStatus,
    occupation: data.occupation,
    nationality: data.nationality,
    stateOfOrigin: data.stateOfOrigin,
    languages: data.languages,
    altPhone: data.altPhone,
    email: data.email,
    address: data.address,
    city: data.city,
    state: data.state,
    landmark: data.landmark,
    preferredContact: data.preferredContact,
    branch: data.branchId ? { connect: { id: data.branchId } } : { disconnect: true },
    yearJoined: data.yearJoined,
    officeHeld: data.officeHeld,
    halaqah: data.halaqah,
    islamicEducation: data.islamicEducation,
    otherSkills: data.otherSkills,
    availability: data.availability,
    notes: data.notes,
    accessNeeds: data.accessNeeds,
    nokName: data.nokName,
    nokRelationship: data.nokRelationship,
    nokPhone: data.nokPhone,
    nokAltPhone: data.nokAltPhone,
    consentRecords: data.consentRecords,
    consentDirectory: data.consentDirectory,
    consentComms: data.consentComms,
    consentBiometric: data.consentBiometric,
    serviceAreas: {
      deleteMany: {},
      create: data.serviceAreaIds.map((serviceAreaId) => ({ serviceAreaId })),
    },
  };
}
