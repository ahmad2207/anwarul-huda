import { describe, expect, it } from "vitest";
import { validateNominalRollRow } from "./validate-nominal-roll-row";
import type { NominalRollRefData } from "./validate-nominal-roll-row";

const WING = { id: "wing-1", name: "Men's wing", numberLetter: "M", code: "MENS" };

function refs(overrides: Partial<NominalRollRefData> = {}): NominalRollRefData {
  return {
    wings: [WING],
    actor: { roles: ["SUPER_ADMIN"], wingIds: [] },
    ...overrides,
  };
}

const MAPPING: Record<string, string | null> = {
  fullName: "Full Name",
  wing: "Wing",
  gender: "Gender",
  title: "Title",
  sourceSn: "S/N",
  sourcePage: "Page",
  needsReview: "Needs Review",
};

function rawRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "Full Name": "Suleiman Abdullahi",
    Wing: "Men's wing",
    Gender: "Male",
    Title: "",
    "S/N": "12",
    Page: "3",
    "Needs Review": "",
    ...overrides,
  };
}

function mapRow(raw: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const key of Object.keys(MAPPING)) {
    const header = MAPPING[key];
    mapped[key] = header ? (raw[header] ?? "").trim() : "";
  }
  return mapped;
}

function validate(rawOverrides: Record<string, string> = {}, refsOverrides: Partial<NominalRollRefData> = {}) {
  const raw = rawRow(rawOverrides);
  const mapped = mapRow(raw);
  return validateNominalRollRow(1, raw, mapped, refs(refsOverrides));
}

describe("validateNominalRollRow", () => {
  it("classifies a fully valid row as clean, with no phone or split name required", () => {
    const result = validate();
    expect(result.classification).toBe("clean");
    expect(result.issues).toHaveLength(0);
    expect(result.data?.fullNameAsWritten).toBe("Suleiman Abdullahi");
    expect(result.data?.wingId).toBe(WING.id);
    expect(result.data?.gender).toBe("MALE");
    expect(result.data?.officeHeld).toBeNull();
  });

  it("fails a row with no full name", () => {
    const result = validate({ "Full Name": "" });
    expect(result.classification).toBe("fail");
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.field === "fullName")).toBe(true);
  });

  it("fails a row with no gender, unlike the full import this does not tolerate a blank here", () => {
    const result = validate({ Gender: "" });
    expect(result.classification).toBe("fail");
    expect(result.issues.some((issue) => issue.field === "gender")).toBe(true);
  });

  it("fails a row whose wing does not resolve", () => {
    const result = validate({ Wing: "Nonexistent wing" });
    expect(result.classification).toBe("fail");
    expect(result.issues.some((issue) => issue.field === "wing")).toBe(true);
  });

  it("fails a row for a wing the importing wing admin cannot access", () => {
    const result = validate({}, { actor: { roles: ["WING_ADMIN"], wingIds: ["a-different-wing"] } });
    expect(result.classification).toBe("fail");
    expect(result.issues.some((issue) => issue.field === "wing")).toBe(true);
  });

  it("splits an appended job title into officeHeld only when the row is flagged for it", () => {
    const result = validate({
      "Full Name": "Ganiyu Tailor",
      "Needs Review": "job title appended to name",
    });
    expect(result.classification).toBe("clean");
    expect(result.data?.fullNameAsWritten).toBe("Ganiyu");
    expect(result.data?.officeHeld).toBe("Tailor");
    expect(result.data?.notes).toContain("committee decision");
  });

  it("does not split a name that merely contains a job-sounding word without the flag", () => {
    const result = validate({ "Full Name": "Musa Tailor" });
    expect(result.classification).toBe("clean");
    expect(result.data?.fullNameAsWritten).toBe("Musa Tailor");
    expect(result.data?.officeHeld).toBeNull();
  });

  it("carries needs_review verbatim into notes", () => {
    const result = validate({ "Needs Review": "single name only" });
    expect(result.data?.notes).toContain("single name only");
  });

  it("extracts the duplicate S/N reference for resolution after commit, without changing classification", () => {
    const result = validate({ "S/N": "36", "Needs Review": "possible duplicate of S/N 102" });
    expect(result.classification).toBe("clean");
    expect(result.data?.duplicateOfSn).toBe("102");
    expect(result.data?.sourceSn).toBe("36");
    expect(result.data?.notes).toContain("possible duplicate of S/N 102");
  });
});
