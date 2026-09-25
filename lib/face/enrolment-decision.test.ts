import { describe, expect, it } from "vitest";
import { decideEnrolment } from "./enrolment-decision";
import { duplicateDetectionThreshold, UNCALIBRATED_MATCH_THRESHOLD } from "./thresholds";

const NONE = new Set<string>();

describe("duplicateDetectionThreshold", () => {
  it("never sits above the check-in threshold", () => {
    expect(duplicateDetectionThreshold()).toBeLessThanOrEqual(UNCALIBRATED_MATCH_THRESHOLD);
  });

  it("moves with the check-in threshold when that is recalibrated", () => {
    expect(duplicateDetectionThreshold(0.6)).toBeCloseTo(0.55);
  });
});

describe("decideEnrolment", () => {
  it("saves when nobody is close", () => {
    expect(decideEnrolment("me", [{ memberId: "other", similarity: 0.2 }], NONE, 0.45)).toEqual({ kind: "save" });
  });

  it("treats a match to the member's own earlier enrolment as re-enrolment", () => {
    expect(decideEnrolment("me", [{ memberId: "me", similarity: 0.9 }], NONE, 0.45)).toEqual({ kind: "save" });
  });

  it("blocks a match to another member at the threshold, even below the check-in threshold", () => {
    const decision = decideEnrolment("me", [{ memberId: "brother", similarity: 0.45 }], NONE, 0.45);
    expect(decision).toEqual({ kind: "conflict", matches: [{ memberId: "brother", similarity: 0.45 }] });
  });

  it("still blocks when the member's own face also matches", () => {
    const decision = decideEnrolment(
      "me",
      [
        { memberId: "me", similarity: 0.92 },
        { memberId: "twin", similarity: 0.7 },
      ],
      NONE,
      0.45,
    );
    expect(decision.kind).toBe("conflict");
  });

  it("reports every conflicting member, closest first", () => {
    const decision = decideEnrolment(
      "me",
      [
        { memberId: "a", similarity: 0.5 },
        { memberId: "b", similarity: 0.8 },
      ],
      NONE,
      0.45,
    );
    expect(decision).toEqual({
      kind: "conflict",
      matches: [
        { memberId: "b", similarity: 0.8 },
        { memberId: "a", similarity: 0.5 },
      ],
    });
  });

  it("no longer blocks on a pair an administrator dismissed", () => {
    expect(decideEnrolment("me", [{ memberId: "lookalike", similarity: 0.6 }], new Set(["lookalike"]), 0.45)).toEqual({
      kind: "save",
    });
  });
});
