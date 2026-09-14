import { describe, expect, it } from "vitest";
import { computePeriod } from "./period";

// A Lagos-local instant is built as UTC noon on the calendar day, well
// clear of the UTC+1 boundary, so these tests are not sensitive to
// exactly which hour they run at.
function lagosNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 11, 0, 0));
}

describe("computePeriod", () => {
  it("computes a monthly period", () => {
    const period = computePeriod("MONTHLY", lagosNoon(2026, 9, 14));
    expect(period.periodLabel).toBe("2026-09");
    expect(period.periodStart.toISOString()).toBe("2026-08-31T23:00:00.000Z");
    expect(period.periodEnd.toISOString()).toBe("2026-09-30T23:00:00.000Z");
  });

  it("rolls a monthly period over into the next year", () => {
    const period = computePeriod("MONTHLY", lagosNoon(2026, 12, 20));
    expect(period.periodLabel).toBe("2026-12");
    expect(period.periodEnd.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });

  it("computes a quarterly period", () => {
    const period = computePeriod("QUARTERLY", lagosNoon(2026, 9, 14));
    expect(period.periodLabel).toBe("2026-Q3");
    expect(period.periodStart.toISOString()).toBe("2026-06-30T23:00:00.000Z");
    expect(period.periodEnd.toISOString()).toBe("2026-09-30T23:00:00.000Z");
  });

  it("computes an annual period", () => {
    const period = computePeriod("ANNUAL", lagosNoon(2026, 3, 1));
    expect(period.periodLabel).toBe("2026");
    expect(period.periodStart.toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(period.periodEnd.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });

  it("computes a weekly period spanning Monday to Sunday", () => {
    // 14 September 2026 is a Monday.
    const period = computePeriod("WEEKLY", lagosNoon(2026, 9, 14));
    expect(period.periodLabel).toBe("2026-W38");
    expect(period.periodStart.toISOString()).toBe("2026-09-13T23:00:00.000Z");
    expect(period.periodEnd.toISOString()).toBe("2026-09-20T23:00:00.000Z");
  });

  it("gives every day in the same iso week the same weekly label", () => {
    const monday = computePeriod("WEEKLY", lagosNoon(2026, 9, 14));
    const sunday = computePeriod("WEEKLY", lagosNoon(2026, 9, 20));
    expect(sunday.periodLabel).toBe(monday.periodLabel);
    expect(sunday.periodStart.toISOString()).toBe(monday.periodStart.toISOString());
  });

  it("assigns the iso week at a year boundary to the correct iso year", () => {
    // 1 January 2027 is a Friday, in the last iso week of 2026.
    const period = computePeriod("WEEKLY", lagosNoon(2027, 1, 1));
    expect(period.periodLabel).toBe("2026-W53");
  });

  it("always uses the same fixed label for a one-off plan", () => {
    const first = computePeriod("ONE_OFF", lagosNoon(2026, 1, 5));
    const later = computePeriod("ONE_OFF", lagosNoon(2027, 6, 30));
    expect(first.periodLabel).toBe("ONE-OFF");
    expect(later.periodLabel).toBe("ONE-OFF");
  });
});
