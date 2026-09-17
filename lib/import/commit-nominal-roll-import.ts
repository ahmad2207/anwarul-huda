import type { Prisma } from "@prisma/client";
import { writeAuditMany } from "@/lib/audit";
import { generateMemberNumber } from "@/lib/member-number";
import type { NominalRollPreviewGroups } from "./compute-nominal-roll-preview";
import type { WingLetterRef } from "./commit-import";

export interface NominalRollCommitOutcome {
  created: number;
  failed: number;
  duplicateFlagsRaised: number;
}

/**
 * Writes every clean row to the member register, inside the caller's
 * transaction, the same way commitImportRows does for the full import.
 * Two things are specific to a nominal roll: nothing here ever updates an
 * existing member (there is no reliable key to match one by), and once
 * every row is written, each row's "possible duplicate of S/N n" note is
 * resolved into the member ID that row became, raising a
 * MemberDuplicateFlag for a human to look at, rather than deciding
 * anything automatically.
 */
export async function commitNominalRollRows(
  tx: Prisma.TransactionClient,
  batchId: string,
  groups: NominalRollPreviewGroups,
  actorId: string,
  wings: WingLetterRef[],
): Promise<NominalRollCommitOutcome> {
  const outcome: NominalRollCommitOutcome = { created: 0, failed: groups.fail.length, duplicateFlagsRaised: 0 };
  const auditEntries: Parameters<typeof writeAuditMany>[0] = [];
  const wingLetterById = new Map(wings.map((wing) => [wing.id, wing.numberLetter]));

  // Keyed by this roll's own serial number, so a "possible duplicate of
  // S/N n" note can be resolved into a real member ID once every row in
  // this batch has been written, below.
  const memberIdBySourceSn = new Map<string, string>();
  const duplicateReferences: Array<{ memberId: string; sourceSn: string; duplicateOfSn: string }> = [];

  for (const row of groups.clean) {
    if (!row.data) continue; // cannot happen: only fail rows have null data

    const wingNumberLetter = wingLetterById.get(row.data.wingId);
    if (!wingNumberLetter) {
      // Cannot happen: validateNominalRollRow already refused any row
      // whose wing does not resolve to a known wing. Guarded anyway, the
      // same way commitImportRows guards it, so a future change to that
      // rule cannot silently issue a malformed member number here.
      outcome.failed += 1;
      continue;
    }
    const memberNumber = await generateMemberNumber(tx, { wingId: row.data.wingId, wingNumberLetter });

    const created = await tx.member.create({
      data: {
        memberNumber,
        title: row.data.title,
        fullNameAsWritten: row.data.fullNameAsWritten,
        gender: row.data.gender,
        wing: { connect: { id: row.data.wingId } },
        officeHeld: row.data.officeHeld,
        notes: row.data.notes,
        isRecordIncomplete: true,
        status: "ACTIVE",
        source: "CSV_IMPORT",
        importBatch: { connect: { id: batchId } },
      },
    });
    outcome.created += 1;

    if (row.data.sourceSn) {
      memberIdBySourceSn.set(row.data.sourceSn, created.id);
    }
    if (row.data.duplicateOfSn && row.data.sourceSn) {
      duplicateReferences.push({
        memberId: created.id,
        sourceSn: row.data.sourceSn,
        duplicateOfSn: row.data.duplicateOfSn,
      });
    }

    auditEntries.push({
      actorId,
      action: "member.imported_nominal_roll",
      entity: "Member",
      entityId: created.id,
      before: null,
      after: created,
    });
  }

  // Resolve each "possible duplicate of S/N n" into a real pair of member
  // IDs, and raise one flag per pair, not one per row: the roll notes
  // this both ways (S/N 36 says "duplicate of S/N 102", and S/N 102 says
  // "duplicate of S/N 36"), which is the same pair seen twice.
  const flaggedPairs = new Set<string>();
  for (const ref of duplicateReferences) {
    const otherMemberId = memberIdBySourceSn.get(ref.duplicateOfSn);
    if (!otherMemberId || otherMemberId === ref.memberId) continue;

    const pairKey = [ref.memberId, otherMemberId].sort().join(":");
    if (flaggedPairs.has(pairKey)) continue;
    flaggedPairs.add(pairKey);

    await tx.memberDuplicateFlag.create({
      data: {
        memberAId: ref.memberId,
        memberBId: otherMemberId,
        reason: `Flagged on the source roll: S/N ${ref.sourceSn} noted as a possible duplicate of S/N ${ref.duplicateOfSn}.`,
      },
    });
    outcome.duplicateFlagsRaised += 1;
  }

  await writeAuditMany(auditEntries, tx);

  return outcome;
}
