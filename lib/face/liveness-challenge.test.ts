import { describe, expect, it } from "vitest";
import { LIVENESS_CHALLENGES, challengeSatisfied, pickRandomChallenge } from "./liveness-challenge";

describe("pickRandomChallenge", () => {
  it("always returns one of the three defined challenges", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(LIVENESS_CHALLENGES).toContainEqual(pickRandomChallenge());
    }
  });
});

describe("challengeSatisfied", () => {
  it("is not satisfied by a still, roughly frontal sequence", () => {
    const readings = [
      { yaw: 0.01, pitch: 0.01 },
      { yaw: -0.02, pitch: 0.0 },
      { yaw: 0.0, pitch: -0.01 },
    ];
    expect(challengeSatisfied("TURN_LEFT", readings)).toBe(false);
    expect(challengeSatisfied("TURN_RIGHT", readings)).toBe(false);
    expect(challengeSatisfied("NOD", readings)).toBe(false);
  });

  it("recognises a left turn only for the left challenge", () => {
    // Positive yaw: the subject's own left, on the camera's right side of
    // frame, per the mirror relationship of a subject facing the camera.
    const readings = [{ yaw: 0.01, pitch: 0 }, { yaw: 0.35, pitch: 0 }, { yaw: 0.0, pitch: 0 }];
    expect(challengeSatisfied("TURN_LEFT", readings)).toBe(true);
    expect(challengeSatisfied("TURN_RIGHT", readings)).toBe(false);
  });

  it("recognises a right turn only for the right challenge", () => {
    const readings = [{ yaw: 0.01, pitch: 0 }, { yaw: -0.35, pitch: 0 }, { yaw: 0.0, pitch: 0 }];
    expect(challengeSatisfied("TURN_RIGHT", readings)).toBe(true);
    expect(challengeSatisfied("TURN_LEFT", readings)).toBe(false);
  });

  it("recognises a nod in either direction", () => {
    expect(challengeSatisfied("NOD", [{ yaw: 0, pitch: -0.3 }])).toBe(true);
    expect(challengeSatisfied("NOD", [{ yaw: 0, pitch: 0.3 }])).toBe(true);
  });

  it("requires only one qualifying frame anywhere in the sequence", () => {
    const readings = [
      { yaw: 0, pitch: 0 },
      { yaw: 0, pitch: 0 },
      { yaw: 0.25, pitch: 0 },
      { yaw: 0, pitch: 0 },
    ];
    expect(challengeSatisfied("TURN_LEFT", readings)).toBe(true);
  });
});
