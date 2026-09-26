import { describe, expect, it } from "vitest";
import { validateFaceThresholds } from "./threshold-settings";

// Pure checks only. Saving a setting is deliberately not exercised
// against the database here: the database these tests use is shared, and
// a saved setting would change the live check-in threshold while the
// test ran.
describe("validateFaceThresholds", () => {
  it("accepts sensible values", () => {
    expect(validateFaceThresholds(0.55, 0.05)).toBeNull();
    expect(validateFaceThresholds(0.55, 0)).toBeNull();
  });

  it("refuses a threshold that would switch face check-in off or let anyone through", () => {
    expect(validateFaceThresholds(0, 0.05)).toMatch(/between 0 and 1/);
    expect(validateFaceThresholds(1, 0.05)).toMatch(/between 0 and 1/);
    expect(validateFaceThresholds(Number.NaN, 0.05)).toMatch(/between 0 and 1/);
  });

  it("refuses a margin outside 0 to 0.5", () => {
    expect(validateFaceThresholds(0.55, -0.01)).toMatch(/margin/);
    expect(validateFaceThresholds(0.55, 0.6)).toMatch(/margin/);
  });
});
