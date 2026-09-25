import { describe, expect, it } from "vitest";
import { z } from "zod";
import { lagosDateTime, optionalLagosDateTime } from "./zod-helpers";

// The typed time is Lagos time, whatever zone the server runs in.
describe("lagosDateTime", () => {
  const schema = lagosDateTime("Start time is required", "Enter a valid start time");

  it("reads a typed time as Lagos time, an hour ahead of UTC", () => {
    expect(schema.parse("2026-09-26T13:30").toISOString()).toBe("2026-09-26T12:30:00.000Z");
  });

  it("reports a blank value as required and a malformed one as invalid", () => {
    expect(schema.safeParse("").error?.issues[0]?.message).toBe("Start time is required");
    expect(schema.safeParse("2026-02-30T10:00").error?.issues[0]?.message).toBe("Enter a valid start time");
  });
});

describe("optionalLagosDateTime", () => {
  const schema = z.object({ endsAt: optionalLagosDateTime("Enter a valid end time") });

  it("treats a blank or missing value as not given", () => {
    expect(schema.parse({ endsAt: "" }).endsAt).toBeUndefined();
    expect(schema.parse({ endsAt: null }).endsAt).toBeUndefined();
  });

  it("reads a given value as Lagos time", () => {
    expect(schema.parse({ endsAt: "2026-09-26T15:00" }).endsAt?.toISOString()).toBe("2026-09-26T14:00:00.000Z");
  });
});
