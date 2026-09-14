import { describe, expect, it } from "vitest";
import { getPreviousPeriod } from "./period-comparison";

describe("getPreviousPeriod", () => {
  it("returns an equal-length window immediately before the given period", () => {
    const previous = getPreviousPeriod({
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-30T00:00:00.000Z"),
    });
    // Same 29 day span, ending 1ms before September starts.
    expect(previous.to.toISOString()).toBe("2026-08-31T23:59:59.999Z");
    expect(previous.from.toISOString()).toBe("2026-08-02T23:59:59.999Z");
  });

  it("handles a period that is not a whole calendar month", () => {
    const previous = getPreviousPeriod({
      from: new Date("2026-09-10T00:00:00.000Z"),
      to: new Date("2026-09-17T00:00:00.000Z"),
    });
    const durationMs =
      new Date("2026-09-17T00:00:00.000Z").getTime() - new Date("2026-09-10T00:00:00.000Z").getTime();
    expect(previous.to.getTime() - previous.from.getTime()).toBe(durationMs);
    expect(previous.to.getTime()).toBe(new Date("2026-09-10T00:00:00.000Z").getTime() - 1);
  });
});
