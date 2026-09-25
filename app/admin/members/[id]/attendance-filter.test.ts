import { describe, expect, it } from "vitest";
import { parseAttendanceFilter } from "./attendance-filter";

const NOW = new Date("2026-09-25T10:00:00.000Z"); // 25 September 2026, 11:00 in Lagos

describe("parseAttendanceFilter", () => {
  it("defaults to this Lagos year up to and including today", () => {
    const filter = parseAttendanceFilter({}, NOW);
    expect(filter.fromValue).toBe("2026-01-01");
    expect(filter.toValue).toBe("2026-09-25");
    expect(filter.from.toISOString()).toBe("2025-12-31T23:00:00.000Z");
    // Exclusive end: Lagos midnight at the start of 26 September.
    expect(filter.to.toISOString()).toBe("2026-09-25T23:00:00.000Z");
    expect(filter.type).toBeUndefined();
  });

  it("uses a given range, including the whole of the last day", () => {
    const filter = parseAttendanceFilter({ from: "2026-03-01", to: "2026-03-31" }, NOW);
    expect(filter.from.toISOString()).toBe("2026-02-28T23:00:00.000Z");
    expect(filter.to.toISOString()).toBe("2026-03-31T23:00:00.000Z");
  });

  it("swaps a range given backwards", () => {
    const filter = parseAttendanceFilter({ from: "2026-03-31", to: "2026-03-01" }, NOW);
    expect(filter.fromValue).toBe("2026-03-01");
    expect(filter.toValue).toBe("2026-03-31");
  });

  it("falls back to the default for a malformed date and ignores an unknown type", () => {
    const filter = parseAttendanceFilter({ from: "yesterday", type: "PARTY" }, NOW);
    expect(filter.fromValue).toBe("2026-01-01");
    expect(filter.type).toBeUndefined();
  });

  it("keeps a known gathering type", () => {
    expect(parseAttendanceFilter({ type: "JUMUAH" }, NOW).type).toBe("JUMUAH");
  });
});
