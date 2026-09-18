import { describe, expect, it } from "vitest";
import { ageInYears } from "./age";

describe("ageInYears", () => {
  it("counts a whole year once the birthday has passed this year", () => {
    expect(ageInYears(new Date("2008-03-01"), new Date("2026-03-01"))).toBe(18);
    expect(ageInYears(new Date("2008-03-01"), new Date("2026-06-15"))).toBe(18);
  });

  it("does not count the year until the birthday arrives", () => {
    expect(ageInYears(new Date("2008-09-20"), new Date("2026-09-17"))).toBe(17);
  });

  it("counts the birthday itself as the new age", () => {
    expect(ageInYears(new Date("2008-09-17"), new Date("2026-09-17"))).toBe(18);
  });
});
