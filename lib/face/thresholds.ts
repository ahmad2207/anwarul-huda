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
