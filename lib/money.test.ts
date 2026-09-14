import { describe, expect, it } from "vitest";
import { addKobo, formatNaira, nairaToKobo, subtractKobo, sumKobo } from "./money";

describe("money", () => {
  it("adds and subtracts kobo amounts", () => {
    expect(addKobo(100, 50)).toBe(150);
    expect(subtractKobo(100, 50)).toBe(50);
  });

  it("rejects non-integer amounts", () => {
    expect(() => addKobo(100.5, 1)).toThrow();
  });

  it("sums a list of kobo amounts", () => {
    expect(sumKobo([100, 200, 300])).toBe(600);
    expect(sumKobo([])).toBe(0);
  });

  it("converts whole Naira to kobo", () => {
    expect(nairaToKobo(1250)).toBe(125000);
  });

  it("rejects fractional Naira that does not convert cleanly", () => {
    expect(() => nairaToKobo(12.505)).toThrow();
  });

  it("formats kobo as Naira", () => {
    expect(formatNaira(125000)).toBe("N1,250.00");
    expect(formatNaira(50)).toBe("N0.50");
    expect(formatNaira(-125000)).toBe("-N1,250.00");
  });
});
