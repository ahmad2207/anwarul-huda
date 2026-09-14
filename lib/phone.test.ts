import { describe, expect, it } from "vitest";
import {
  formatNigerianPhoneForDisplay,
  isValidNigerianPhone,
  normalizeNigerianPhone,
} from "./phone";

describe("phone", () => {
  it("normalises local format starting with 0", () => {
    expect(normalizeNigerianPhone("08012345678")).toBe("+2348012345678");
  });

  it("normalises a number with no leading 0", () => {
    expect(normalizeNigerianPhone("8012345678")).toBe("+2348012345678");
  });

  it("normalises E.164 input unchanged", () => {
    expect(normalizeNigerianPhone("+2348012345678")).toBe("+2348012345678");
  });

  it("normalises input with spaces and dashes", () => {
    expect(normalizeNigerianPhone("080-1234-5678")).toBe("+2348012345678");
    expect(normalizeNigerianPhone("+234 801 234 5678")).toBe("+2348012345678");
  });

  it("rejects a number that is too short", () => {
    expect(() => normalizeNigerianPhone("080123")).toThrow();
    expect(isValidNigerianPhone("080123")).toBe(false);
  });

  it("rejects a landline style prefix", () => {
    expect(() => normalizeNigerianPhone("01234567890")).toThrow();
  });

  it("formats an E.164 number for display", () => {
    expect(formatNigerianPhoneForDisplay("+2348012345678")).toBe("0801 234 5678");
  });
});
