// A randomly chosen small action, satisfied against nothing but head
// pose angles the face detector already returns (radians: see
// https://github.com/vladmandic/human/discussions/313), never against
// pixels. This is one of two gates SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md
// 3.4 asks for; the library's own antispoof and liveness scores
// (FaceResult.real and .live) are the other, checked alongside this in
// the capture component.
//
// The angle thresholds below are a placeholder, not a calibrated
// figure: the same position B3 is in for the match threshold itself,
// which the addendum is explicit must come from real data collected at
// the actual mosque, not from documentation. These need the same
// treatment once real attempts can be recorded.

export type LivenessChallengeId = "TURN_LEFT" | "TURN_RIGHT" | "NOD";

export interface LivenessChallenge {
  id: LivenessChallengeId;
  instruction: string;
}

export const LIVENESS_CHALLENGES: readonly LivenessChallenge[] = [
  { id: "TURN_LEFT", instruction: "Slowly turn your head to the left" },
  { id: "TURN_RIGHT", instruction: "Slowly turn your head to the right" },
  { id: "NOD", instruction: "Slowly nod your head" },
];

export function pickRandomChallenge(): LivenessChallenge {
  const index = Math.floor(Math.random() * LIVENESS_CHALLENGES.length);
  return LIVENESS_CHALLENGES[index];
}

export interface HeadPoseReading {
  /** Radians. Negative is left, positive is right. */
  yaw: number;
  /** Radians. Negative is down, positive is up. */
  pitch: number;
}

// UNCALIBRATED. ~11.5 degrees: a guess at "a clear, deliberate turn or
// nod, not a natural head wobble from holding a phone steady", not a
// figure measured against a real attempt. Exactly the position B3 is in
// for the match threshold, and needs the same treatment: real captures
// at the mosque, reporting false accepts and false rejects across a
// range of values, before this ships as a real number rather than a
// placeholder that happens to compile.
const UNCALIBRATED_YAW_THRESHOLD_RADIANS = 0.2;
const UNCALIBRATED_PITCH_THRESHOLD_RADIANS = 0.15;

/**
 * True once somewhere in the captured sequence of readings, the
 * requested movement actually happened. Checking across the whole
 * sequence rather than only the last frame is what makes this a
 * liveness check on a movement rather than a single pose a still
 * photograph, held at an angle, could also satisfy.
 */
export function challengeSatisfied(challenge: LivenessChallengeId, readings: HeadPoseReading[]): boolean {
  switch (challenge) {
    case "TURN_LEFT":
      return readings.some((reading) => reading.yaw <= -UNCALIBRATED_YAW_THRESHOLD_RADIANS);
    case "TURN_RIGHT":
      return readings.some((reading) => reading.yaw >= UNCALIBRATED_YAW_THRESHOLD_RADIANS);
    case "NOD":
      return readings.some((reading) => Math.abs(reading.pitch) >= UNCALIBRATED_PITCH_THRESHOLD_RADIANS);
  }
}
