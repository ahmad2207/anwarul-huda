import { describe, expect, it } from "vitest";
import { addKobo, formatNaira, MAX_KOBO, MoneyError, nairaToKobo, parseNairaText, subtractKobo, sumKobo } from "./money";

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
    expect(formatNaira(125000)).toBe("₦1,250.00");
    expect(formatNaira(50)).toBe("₦0.50");
    expect(formatNaira(-125000)).toBe("-₦1,250.00");
  });
});

describe("parseNairaText", () => {
  it("reads whole and two-place Naira amounts straight to kobo", () => {
    expect(parseNairaText("1250")).toBe(125000);
    expect(parseNairaText("1,250.5")).toBe(125050);
    expect(parseNairaText(" 0.01 ")).toBe(1);
    expect(parseNairaText("19.99")).toBe(1999);
  });

  it("refuses anything that is not a plain decimal amount", () => {
    for (const input of ["1e3", "0x10", "-5", "12.345", "", "abc", "Infinity", "1 000"]) {
      expect(() => parseNairaText(input), input).toThrow(MoneyError);
    }
  });

  it("refuses zero unless the caller allows it", () => {
    expect(() => parseNairaText("0")).toThrow(MoneyError);
    expect(parseNairaText("0", { allowZero: true })).toBe(0);
  });

  it("refuses an amount larger than a kobo column can hold", () => {
    expect(parseNairaText("21474836.47")).toBe(MAX_KOBO);
    expect(() => parseNairaText("21474836.48")).toThrow(MoneyError);
  });
});
