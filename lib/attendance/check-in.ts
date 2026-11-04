import type { AttendanceRecord, CheckInMethod, Prisma } from "@prisma/client";

export interface CheckInInput {
  gatheringId: string;
  memberId: string;
  method: CheckInMethod;
  recordedById: string | null;
  /** Set only for method FACE (SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md 3.4: "log the liveness score and the match score on every face check-in"). */
  matchScore?: number;
  livenessScore?: number;
  /** Set only for method FACE: how far the match stood above the runner-up (MEMBER-HOME-AND-ADMIN-VIEW.md 3.4). Null when there was no runner-up. */
  matchMargin?: number | null;
}

export interface CheckInResult {
  record: AttendanceRecord;
  /** True when this member was already checked in to this gathering; the existing row is returned, nothing new was written. */
  alreadyCheckedIn: boolean;
}

/**
 * Checks a member in to a gathering. A duplicate check-in for the same
 * member and gathering is silently treated as success rather than an
 * error (docs/SPEC.md 2.6, Phase 5 item 4): the caller gets back the
 * existing record and alreadyCheckedIn: true, never a thrown error, so
 * an officer tapping the same result twice (easy to do at a standing
 * check-in desk) is never shown a failure. The database's own unique
 * constraint on (gatheringId, memberId) is the backstop that makes this
 * safe under concurrency, not just this read-then-write.
 */
export async function checkInMember(
  tx: Prisma.TransactionClient,
  input: CheckInInput,
): Promise<CheckInResult> {
  const existing = await tx.attendanceRecord.findUnique({
    where: { gatheringId_memberId: { gatheringId: input.gatheringId, memberId: input.memberId } },
  });
  if (existing) {
    return { record: existing, alreadyCheckedIn: true };
  }

  // INSERT ... ON CONFLICT DO NOTHING (createMany with skipDuplicates),
  // not a create that catches the unique violation: in Postgres a failed
  // insert aborts the whole transaction, so the old catch-and-read-back
  // could never run and a double tap showed the officer an error. Here a
  // race simply inserts nothing, and the row that won is read back.
  const inserted = await tx.attendanceRecord.createMany({
    data: [
      {
        gatheringId: input.gatheringId,
        memberId: input.memberId,
        checkedInAt: new Date(),
        method: input.method,
        recordedById: input.recordedById,
        matchScore: input.matchScore,
        livenessScore: input.livenessScore,
        matchMargin: input.matchMargin ?? null,
      },
    ],
    skipDuplicates: true,
  });
  const record = await tx.attendanceRecord.findUniqueOrThrow({
    where: { gatheringId_memberId: { gatheringId: input.gatheringId, memberId: input.memberId } },
  });
  return { record, alreadyCheckedIn: inserted.count === 0 };
}
