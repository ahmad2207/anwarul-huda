import { describe, expect, it } from "vitest";
import { firstNameForGreeting, formatMemberName } from "./display-name";

describe("formatMemberName", () => {
  it("joins surname and first name when both are known", () => {
    expect(formatMemberName({ surname: "Bello", firstName: "Amina" })).toBe("Bello Amina");
  });

  it("falls back to the name as written on the roll", () => {
    expect(
      formatMemberName({ surname: null, firstName: null, fullNameAsWritten: "Imam Suleiman Sa'ad" }),
    ).toBe("Imam Suleiman Sa'ad");
  });

  it("falls back to whichever of surname or first name is present", () => {
    expect(formatMemberName({ surname: "Bello", firstName: null })).toBe("Bello");
    expect(formatMemberName({ surname: null, firstName: "Amina" })).toBe("Amina");
  });

  it("never renders the word null when nothing is on file", () => {
    expect(formatMemberName({ surname: null, firstName: null })).toBe("Name not on file");
  });
});

describe("firstNameForGreeting", () => {
  it("uses firstName when it is on file", () => {
    expect(firstNameForGreeting({ surname: "Bello", firstName: "Amina" })).toBe("Amina");
  });

  it("takes the first word of the roll's name when firstName is missing", () => {
    expect(
      firstNameForGreeting({ surname: null, firstName: null, fullNameAsWritten: "Imam Suleiman Sa'ad" }),
    ).toBe("Imam");
  });

  it("returns null rather than a placeholder when nothing is on file at all", () => {
    expect(firstNameForGreeting({ surname: null, firstName: null })).toBeNull();
  });

  it("returns null for a name as written that is only whitespace", () => {
    expect(firstNameForGreeting({ surname: null, firstName: null, fullNameAsWritten: "   " })).toBeNull();
  });
});
