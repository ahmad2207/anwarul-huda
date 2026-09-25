import { describe, expect, it } from "vitest";
import {
  parseLagosDate,
  parseLagosDateTimeLocal,
  parseLagosDayEnd,
  parseLagosDayStart,
  toLagosDateInputValue,
} from "./timezone";

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

describe("parseLagosDayStart and parseLagosDayEnd", () => {
  it("covers the whole Lagos day, first millisecond to last", () => {
    expect(parseLagosDayStart("2026-09-25")?.toISOString()).toBe("2026-09-24T23:00:00.000Z");
    expect(parseLagosDayEnd("2026-09-25")?.toISOString()).toBe("2026-09-25T22:59:59.999Z");
  });

  it("includes something that happened late in the evening on the last day", () => {
    const eveningCheckIn = new Date("2026-09-25T20:30:00.000Z"); // 9:30 pm in Lagos
    expect(eveningCheckIn <= parseLagosDayEnd("2026-09-25")!).toBe(true);
  });

  it("rolls over the end of a month and a year", () => {
    expect(parseLagosDayEnd("2026-12-31")?.toISOString()).toBe("2026-12-31T22:59:59.999Z");
  });

  it("ignores a missing or malformed value rather than producing an invalid date", () => {
    expect(parseLagosDayStart(undefined)).toBeUndefined();
    expect(parseLagosDayStart("")).toBeUndefined();
    expect(parseLagosDayEnd("not-a-date")).toBeUndefined();
    expect(parseLagosDayEnd(["2026-09-25"])).toBeUndefined();
  });
});
