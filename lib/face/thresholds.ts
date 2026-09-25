// UNCALIBRATED. Every threshold below is a reasonable-sounding guess,
// not a number measured against a real capture. B3 (SPEC-ADDENDUM-
// ACCOUNTS-AND-FACE.md) is explicit that a match threshold must come
// from real false-accept/false-reject data collected at the actual
// mosque, in the actual lighting, never from documentation; the same
// caution applies to the liveness and antispoof gates enrolment already
// uses. Shared here, not duplicated between enrolment's capture
// (app/account/face/face-capture.tsx) and check-in's matching
// (lib/face/match-face.ts), so there is exactly one place to update
// once B3's calibration tool exists, rather than two that can drift
// apart silently.

/** A detected face below this confidence is not trusted enough to read an embedding or a liveness reading from at all. */
export const UNCALIBRATED_MIN_FACE_SCORE = 0.7;

/** vladmandic/human's own liveness score (motion, blink, etc.), not the anti-spoof score below. */
export const UNCALIBRATED_MIN_LIVENESS_SCORE = 0.6;

/** vladmandic/human's anti-spoof score: how likely the frame is a live subject rather than a photo, screen or mask. */
export const UNCALIBRATED_MIN_ANTISPOOF_SCORE = 0.6;

/** Mean 0-255 luminance sampled from the video frame, below which enrolment refuses to proceed as "too dark to see clearly". */
export const UNCALIBRATED_DARKNESS_THRESHOLD = 40;

/** Cosine similarity a check-in match must reach or exceed to check a member in. Below this, the officer's screen falls back to manual search, not an error. */
export const UNCALIBRATED_MATCH_THRESHOLD = 0.5;

/**
 * How far below the check-in threshold duplicate detection looks, when a
 * new enrolment is compared against every existing one
 * (MEMBER-HOME-AND-ADMIN-VIEW.md 3.3).
 *
 * Deliberately at or below the check-in threshold, never above it. If two
 * enrolled faces score above the check-in threshold against each other,
 * check-in cannot tell those two members apart, and attendance would be
 * silently credited to the wrong one, fraud or not. So anything that
 * could confuse check-in has to be caught here. The margin is there
 * because an enrolment is one capture: a pair sitting just under the
 * check-in threshold at enrolment can cross it on a given day's live
 * capture, in different light. Derived from the check-in threshold, not
 * set on its own, so when B3 moves that threshold, detection moves with
 * it; pairs enrolled under the old value are caught by the retrospective
 * scan.
 */
export const UNCALIBRATED_DUPLICATE_DETECTION_MARGIN = 0.05;

export function duplicateDetectionThreshold(matchThreshold: number = UNCALIBRATED_MATCH_THRESHOLD): number {
  return matchThreshold - UNCALIBRATED_DUPLICATE_DETECTION_MARGIN;
}

/**
 * The smallest gap between the best and the runner-up match that check-in
 * will accept (MEMBER-HOME-AND-ADMIN-VIEW.md 3.4). Below it, check-in
 * refuses and the officer checks the member in by name: a confident wrong
 * answer is worse than no answer.
 */
export const UNCALIBRATED_MIN_MATCH_MARGIN = 0.05;
