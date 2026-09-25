import { describe, expect, it } from "vitest";
import { parseLagosDate, parseLagosDateTimeLocal, toLagosDateInputValue } from "./timezone";

describe("parseLagosDateTimeLocal", () => {
  it("reads the value as Lagos time, an hour ahead of UTC", () => {
    expect(parseLagosDateTimeLocal("2026-09-26T10:00")?.toISOString()).toBe("2026-09-26T09:00:00.000Z");
  });

  it("moves to the previous UTC day for a time just after Lagos midnight", () => {
    expect(parseLagosDateTimeLocal("2026-10-01T00:30")?.toISOString()).toBe("2026-09-30T23:30:00.000Z");
  });

  it("rejects a date that does not exist", () => {
    expect(parseLagosDateTimeLocal("2026-02-31T10:00")).toBeNull();
  });

  it("rejects an out of range time", () => {
    expect(parseLagosDateTimeLocal("2026-09-26T24:00")).toBeNull();
    expect(parseLagosDateTimeLocal("2026-09-26T10:60")).toBeNull();
  });

  it("rejects anything that is not a datetime-local value", () => {
    expect(parseLagosDateTimeLocal("2026-09-26")).toBeNull();
    expect(parseLagosDateTimeLocal("26/09/2026 10:00")).toBeNull();
  });
});

describe("parseLagosDate and toLagosDateInputValue", () => {
  it("reads a date as the start of that Lagos day", () => {
    expect(parseLagosDate("2026-01-01")?.toISOString()).toBe("2025-12-31T23:00:00.000Z");
  });

  it("rejects a date that does not exist", () => {
    expect(parseLagosDate("2026-02-30")).toBeNull();
    expect(parseLagosDate("2026-1-1")).toBeNull();
  });

  it("round trips through a date input value", () => {
    const instant = parseLagosDate("2026-09-25")!;
    expect(toLagosDateInputValue(instant)).toBe("2026-09-25");
  });
});
