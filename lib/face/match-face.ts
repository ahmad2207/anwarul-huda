import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UNCALIBRATED_MATCH_THRESHOLD, UNCALIBRATED_MIN_MATCH_MARGIN } from "@/lib/face/thresholds";
import { toVectorLiteral } from "@/lib/face/vector-literal";

const EMBEDDING_DIMENSIONS = 1024;

interface RawMatchRow {
  memberId: string;
  /** Cosine similarity, 1 meaning identical. Never the embedding itself: nothing here can be turned back into a face. */
  similarity: number;
}

export type FaceMatchResult =
  /** Confident: above threshold, and far enough ahead of the runner-up. margin is null when there was no runner-up. */
  | { kind: "match"; memberId: string; similarity: number; margin: number | null }
  /** Above threshold, but too close to the runner-up to be sure which member it is. */
  | { kind: "ambiguous"; bestSimilarity: number; runnerUpSimilarity: number; margin: number }
  | { kind: "none" };

/**
 * The check-in decision from the two nearest enrolled faces
 * (MEMBER-HOME-AND-ADMIN-VIEW.md 3.4). Below threshold is no match. Above
 * it, the best must also stand at least the minimum margin clear of the
 * runner-up: a confident wrong answer is worse than no answer, so a close
 * call is refused and the officer checks the member in by name. Pure, so
 * the rule is tested without a database.
 */
export function decideFaceMatch(
  nearest: RawMatchRow[],
  threshold: number = UNCALIBRATED_MATCH_THRESHOLD,
  minMargin: number = UNCALIBRATED_MIN_MATCH_MARGIN,
): FaceMatchResult {
  const [best, runnerUp] = nearest;
  if (!best || best.similarity < threshold) {
    return { kind: "none" };
  }
  if (!runnerUp) {
    return { kind: "match", memberId: best.memberId, similarity: best.similarity, margin: null };
  }
  const margin = best.similarity - runnerUp.similarity;
  if (margin < minMargin) {
    return { kind: "ambiguous", bestSimilarity: best.similarity, runnerUpSimilarity: runnerUp.similarity, margin };
  }
  return { kind: "match", memberId: best.memberId, similarity: best.similarity, margin };
}

/**
 * Finds the best enrolled face match for a live embedding, scoped to
 * the gathering's wing (SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md B2 #1),
 * among active members with an active enrolment. Returns "none" below
 * threshold or with no candidates at all, and "ambiguous" when the best
 * match is too close to the runner-up; both are expected, common cases,
 * never an error (B2 #6), just a signal for the caller to fall back to
 * manual search. A member excluded from face check-in by a review is
 * never a candidate.
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
export async function matchFaceForCheckIn(embedding: number[], wingId: string | null): Promise<FaceMatchResult> {
  if (embedding.length !== EMBEDDING_DIMENSIONS || embedding.some((value) => !Number.isFinite(value))) {
    throw new Error(`Expected a ${EMBEDDING_DIMENSIONS} number embedding.`);
  }

  const vectorLiteral = toVectorLiteral(embedding);
  const wingFilter = wingId ? Prisma.sql`AND m.wing_id = ${wingId}` : Prisma.empty;

  // The two nearest, not just the best: the runner-up is what the margin
  // is measured against.
  const rows = await prisma.$queryRaw<RawMatchRow[]>(Prisma.sql`
    SELECT fe.member_id AS "memberId", 1 - (fe.embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM face_enrolments fe
    JOIN members m ON m.id = fe.member_id
    WHERE fe.is_active = true
      AND m.status = 'ACTIVE'
      AND m.face_check_in_excluded = false
      ${wingFilter}
    ORDER BY fe.embedding <=> ${vectorLiteral}::vector ASC
    LIMIT 2
  `);

  return decideFaceMatch(rows);
}
