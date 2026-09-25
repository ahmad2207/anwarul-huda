import { duplicateDetectionThreshold } from "@/lib/face/thresholds";

// What to do with a new face enrolment, given how it compares with the
// faces already enrolled (MEMBER-HOME-AND-ADMIN-VIEW.md 3.2). Pure, so
// the rule can be tested without a camera or a database.

export interface EnrolledCandidate {
  memberId: string;
  /** Cosine similarity to the new capture, 1 meaning identical. */
  similarity: number;
}

export type EnrolmentDecision =
  /** No other member is close enough to confuse check-in: save, replacing any earlier enrolment of this member's own. */
  | { kind: "save" }
  /** Too close to one or more other members' faces: do not save, open a review case for each. */
  | { kind: "conflict"; matches: EnrolledCandidate[] };

/**
 * A match to the member's own earlier enrolment is re-enrolment and never
 * blocks. A match to anyone else at or above the detection threshold
 * blocks, even when the member's own face also matches: two brothers
 * enrolling on the same afternoon must still be caught. Pairs an
 * administrator has already dismissed as "not a real match" are passed in
 * as excluded and never block again.
 */
export function decideEnrolment(
  enrollingMemberId: string,
  candidates: EnrolledCandidate[],
  dismissedMemberIds: ReadonlySet<string>,
  threshold: number = duplicateDetectionThreshold(),
): EnrolmentDecision {
  const matches = candidates
    .filter((candidate) => candidate.memberId !== enrollingMemberId)
    .filter((candidate) => !dismissedMemberIds.has(candidate.memberId))
    .filter((candidate) => candidate.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);

  return matches.length > 0 ? { kind: "conflict", matches } : { kind: "save" };
}
