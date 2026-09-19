import type { Prisma } from "@prisma/client";
import { writeAuditMany } from "@/lib/audit";
import { reserveMemberNumberBlock } from "@/lib/member-number";
import type { NominalRollPreviewGroups } from "./compute-nominal-roll-preview";
import type { ValidatedNominalRollRow } from "./validate-nominal-roll-row";
import type { WingLetterRef } from "./commit-import";

export interface NominalRollCommitOutcome {
  created: number;
  failed: number;
  duplicateFlagsRaised: number;
}

// A named, per-row generated member number and duplicate note ("possible
// duplicate of S/N n") mean every clean row used to be written inside one
// transaction spanning the whole file. A real roll of any size pushed
// that transaction well past Prisma's timeout, since each row costs a
// lock plus a create, both real network round trips: nothing ever
// committed, however many rows the file had. Splitting row creation into
// chunks, each its own transaction, keeps every transaction's own round
// trip count small regardless of file size. State that has to see every
// row no matter which chunk it landed in (memberIdBySourceSn, so a
// later row's duplicate note can resolve to an earlier chunk's member,
// and the audit entries and duplicate references themselves) is
// threaded through explicitly rather than closed over, since it now
// outlives any single chunk's transaction.
export interface NominalRollCommitState {
  memberIdBySourceSn: Map<string, string>;
  duplicateReferences: Array<{ memberId: string; sourceSn: string; duplicateOfSn: string }>;
  auditEntries: Parameters<typeof writeAuditMany>[0];
  created: number;
}

export function createNominalRollCommitState(): NominalRollCommitState {
  return { memberIdBySourceSn: new Map(), duplicateReferences: [], auditEntries: [], created: 0 };
}

/**
 * Writes one chunk of clean rows to the member register, inside the
 * caller's transaction, mutating `state` with what later chunks and
 * finalizeNominalRollImport need. Nothing here ever updates an existing
 * member: there is no reliable key to match one by on a nominal roll.
 *
 * Grouped by wing and bulk inserted, not one row at a time: member
 * numbers are sequenced per wing, so reserveMemberNumberBlock reserves
 * one contiguous block per wing group in a single lock and count, and
 * createManyAndReturn writes the whole group in one insert. Generating
 * and inserting one row at a time cost a lock, a count and a create
 * each, three real network round trips per row, which is what made a
 * whole file's worth of rows too slow for any transaction timeout
 * regardless of chunk size.
 */
export async function commitNominalRollRowsChunk(
  tx: Prisma.TransactionClient,
  batchId: string,
  rows: ValidatedNominalRollRow[],
  actorId: string,
  wings: WingLetterRef[],
  state: NominalRollCommitState,
): Promise<void> {
  const wingLetterById = new Map(wings.map((wing) => [wing.id, wing.numberLetter]));

  const rowsByWing = new Map<string, ValidatedNominalRollRow[]>();
  for (const row of rows) {
    if (!row.data) continue; // cannot happen: only fail rows have null data
    if (!wingLetterById.has(row.data.wingId)) {
      // Cannot happen: validateNominalRollRow already refused any row
      // whose wing does not resolve to a known wing. Guarded anyway, the
      // same way commitImportRows guards it, so a future change to that
      // rule cannot silently issue a malformed member number here.
      continue;
    }
    const wingRows = rowsByWing.get(row.data.wingId) ?? [];
    wingRows.push(row);
    rowsByWing.set(row.data.wingId, wingRows);
  }

  for (const [wingId, wingRows] of rowsByWing) {
    const wingNumberLetter = wingLetterById.get(wingId)!;
    const memberNumbers = await reserveMemberNumberBlock(tx, {
      wingId,
      wingNumberLetter,
      count: wingRows.length,
    });

    const created = await tx.member.createManyAndReturn({
      data: wingRows.map((row, index) => ({
        memberNumber: memberNumbers[index],
        title: row.data!.title,
        fullNameAsWritten: row.data!.fullNameAsWritten,
        gender: row.data!.gender,
        wingId,
        officeHeld: row.data!.officeHeld,
        notes: row.data!.notes,
        isRecordIncomplete: true,
        status: "ACTIVE",
        source: "CSV_IMPORT",
        importBatchId: batchId,
      })),
    });

    for (let index = 0; index < wingRows.length; index++) {
      const row = wingRows[index];
      const createdMember = created[index];
      state.created += 1;

      if (row.data!.sourceSn) {
        state.memberIdBySourceSn.set(row.data!.sourceSn, createdMember.id);
      }
      if (row.data!.duplicateOfSn && row.data!.sourceSn) {
        state.duplicateReferences.push({
          memberId: createdMember.id,
          sourceSn: row.data!.sourceSn,
          duplicateOfSn: row.data!.duplicateOfSn,
        });
      }

      state.auditEntries.push({
        actorId,
        action: "member.imported_nominal_roll",
        entity: "Member",
        entityId: createdMember.id,
        before: null,
        after: createdMember,
      });
    }
  }
}

/**
 * Once every chunk has committed, resolves each "possible duplicate of
 * S/N n" note into a real pair of member IDs and raises one
 * MemberDuplicateFlag per pair, not one per row: the roll notes this
 * both ways (S/N 36 says "duplicate of S/N 102", and S/N 102 says
 * "duplicate of S/N 36"), which is the same pair seen twice. Also writes
 * every accumulated audit entry in the one bulk insert writeAuditMany
 * already is, so this stays a single small transaction regardless of
 * how many chunks came before it.
 */
export async function finalizeNominalRollImport(
  tx: Prisma.TransactionClient,
  state: NominalRollCommitState,
  failedCount: number,
): Promise<NominalRollCommitOutcome> {
  const flaggedPairs = new Set<string>();
  let duplicateFlagsRaised = 0;

  for (const ref of state.duplicateReferences) {
    const otherMemberId = state.memberIdBySourceSn.get(ref.duplicateOfSn);
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
    duplicateFlagsRaised += 1;
  }

  await writeAuditMany(state.auditEntries, tx);

  return { created: state.created, failed: failedCount, duplicateFlagsRaised };
}

/** groups.clean, chunked to a fixed size, for a caller committing it chunk by chunk. */
export function chunkCleanRows(
  groups: NominalRollPreviewGroups,
  chunkSize: number,
): ValidatedNominalRollRow[][] {
  const chunks: ValidatedNominalRollRow[][] = [];
  for (let i = 0; i < groups.clean.length; i += chunkSize) {
    chunks.push(groups.clean.slice(i, i + chunkSize));
  }
  return chunks;
}
