import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UNCALIBRATED_MATCH_THRESHOLD } from "@/lib/face/thresholds";
import { toVectorLiteral } from "@/lib/face/vector-literal";

const EMBEDDING_DIMENSIONS = 1024;

export interface FaceMatch {
  memberId: string;
  /** Cosine similarity, 1 meaning identical. Never the embedding itself: nothing here can be turned back into a face. */
  similarity: number;
}

interface RawMatchRow {
  memberId: string;
  similarity: number;
}

/**
 * Finds the best enrolled face match for a live embedding, scoped to
 * the gathering's wing (SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md B2 #1),
 * among active members with an active enrolment. Returns null below
 * threshold or with no candidates at all; that is the expected, common
 * case this exists to report, an unenrolled or non-matching member is
 * never an error (B2 #6), just a signal for the caller to fall back to
 * manual search.
 *
 * wingId null (an all-wings gathering) matches
 * app/admin/attendance/[id]/actions.ts's loadCheckInRoster, which also
 * only scopes by wing, not branch, despite the addendum's "wing and
 * branch": branch scoping does not exist anywhere else in check-in
 * today, and a face-only candidate pool narrower than what manual
 * search already offers for the same gathering would be a new,
 * confusing inconsistency, not a tightening.
 *
 * The embedding parameter never appears in a log line, an error message
 * or anywhere else this function returns: only the match result does.
 */
export async function matchFaceForCheckIn(embedding: number[], wingId: string | null): Promise<FaceMatch | null> {
  if (embedding.length !== EMBEDDING_DIMENSIONS || embedding.some((value) => !Number.isFinite(value))) {
    throw new Error(`Expected a ${EMBEDDING_DIMENSIONS} number embedding.`);
  }

  const vectorLiteral = toVectorLiteral(embedding);
  const wingFilter = wingId ? Prisma.sql`AND m.wing_id = ${wingId}` : Prisma.empty;

  const rows = await prisma.$queryRaw<RawMatchRow[]>(Prisma.sql`
    SELECT fe.member_id AS "memberId", 1 - (fe.embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM face_enrolments fe
    JOIN members m ON m.id = fe.member_id
    WHERE fe.is_active = true
      AND m.status = 'ACTIVE'
      ${wingFilter}
    ORDER BY fe.embedding <=> ${vectorLiteral}::vector ASC
    LIMIT 1
  `);

  const best = rows[0];
  if (!best || best.similarity < UNCALIBRATED_MATCH_THRESHOLD) {
    return null;
  }
  return best;
}
