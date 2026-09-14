import { describe, expect, it } from "vitest";
import { applyColumnMapping, validateImportRow } from "./validate-row";
import type { ImportRefData } from "./validate-row";

const WING = { id: "wing-1", name: "Women's wing", numberLetter: "W", code: "WOMENS" };
const BRANCH = { id: "branch-1", name: "Central Masjid" };
const SERVICE_AREA = { id: "area-1", name: "Da'wah" };

function refs(overrides: Partial<ImportRefData> = {}): ImportRefData {
  return {
    wings: [WING],
    branches: [BRANCH],
    serviceAreas: [SERVICE_AREA],
    existingByPhone: new Map(),
    actor: { roles: ["SUPER_ADMIN"], wingIds: [] },
    ...overrides,
  };
}

const MAPPING: Record<string, string | null> = {
  surname: "Surname",
  firstName: "First Name",
  gender: "Gender",
  phone: "Phone",
  wing: "Wing",
  dateOfBirth: "DOB",
  email: "Email",
  branch: "Branch",
  serviceAreas: "Areas",
  yearJoined: "Year",
};

function rawRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    Surname: "Bello",
    "First Name": "Amina",
    Gender: "Female",
    Phone: "08012345678",
    Wing: "Women's wing",
    DOB: "1990-05-01",
    Email: "amina@example.test",
    Branch: "Central Masjid",
    Areas: "Da'wah",
    Year: "2020",
    ...overrides,
  };
}

function validate(rawOverrides: Record<string, string> = {}, refsOverrides: Partial<ImportRefData> = {}) {
  const raw = rawRow(rawOverrides);
  const mapped = applyColumnMapping(raw, MAPPING);
  return validateImportRow(1, raw, mapped, refs(refsOverrides));
}

describe("validateImportRow", () => {
  it("classifies a fully valid row as clean", () => {
    const result = validate();
    expect(result.classification).toBe("clean");
    expect(result.issues).toHaveLength(0);
    expect(result.data).not.toBeNull();
    expect(result.data?.phone).toBe("+2348012345678");
    expect(result.data?.wingId).toBe(WING.id);
    expect(result.data?.branchId).toBe(BRANCH.id);
    expect(result.data?.serviceAreaIds).toEqual([SERVICE_AREA.id]);
  });

  it("fails a row missing a required field, with data left null", () => {
    const result = validate({ Surname: "" });
    expect(result.classification).toBe("fail");
    expect(result.data).toBeNull();
    expect(result.issues.some((issue) => issue.field === "surname" && issue.severity === "error")).toBe(
      true,
    );
  });

  it("fails a row with an unrecognisable phone number", () => {
    const result = validate({ Phone: "not a phone" });
    expect(result.classification).toBe("fail");
    expect(result.issues.some((issue) => issue.field === "phone")).toBe(true);
  });

  it("fails a row whose wing does not match a known wing", () => {
    const result = validate({ Wing: "Nonexistent wing" });
    expect(result.classification).toBe("fail");
    expect(result.issues.some((issue) => issue.field === "wing")).toBe(true);
  });

  it("warns rather than fails on a missing email, and still imports", () => {
    const result = validate({ Email: "" });
    expect(result.classification).toBe("warning");
    expect(result.data).not.toBeNull();
    expect(result.data?.email).toBeNull();
    expect(result.issues.some((issue) => issue.field === "email" && issue.severity === "warning")).toBe(
      true,
    );
  });

  it("warns rather than fails on an unparseable date of birth, and drops it", () => {
    const result = validate({ DOB: "not a date" });
    expect(result.classification).toBe("warning");
    expect(result.data?.dateOfBirth).toBeNull();
  });

  it("accepts a day-first date and does not confuse it with month-first", () => {
    const result = validate({ DOB: "25/12/1990" });
    expect(result.classification).toBe("clean");
    expect(result.data?.dateOfBirth?.toISOString().slice(0, 10)).toBe("1990-12-25");
  });

  it("rejects a date that does not exist rather than rolling it over", () => {
    const result = validate({ DOB: "31/02/1990" });
    expect(result.classification).toBe("warning");
    expect(result.data?.dateOfBirth).toBeNull();
  });

  it("warns and drops an unrecognised branch rather than failing the row", () => {
    const result = validate({ Branch: "Some other masjid" });
    expect(result.classification).toBe("warning");
    expect(result.data?.branchId).toBeNull();
  });

  it("flags a duplicate by phone without changing the classification", () => {
    const existing = {
      id: "member-1",
      memberNumber: "AHL/W/2025/0001",
      surname: "Bello",
      firstName: "Amina",
      phone: "+2348012345678",
    };
    const result = validate({}, { existingByPhone: new Map([["+2348012345678", existing]]) });
    expect(result.classification).toBe("clean");
    expect(result.duplicate).toEqual(existing);
  });

  it("fails a row for a wing the importing wing admin cannot access", () => {
    const result = validate(
      {},
      { actor: { roles: ["WING_ADMIN"], wingIds: ["a-different-wing"] } },
    );
    expect(result.classification).toBe("fail");
    expect(result.issues.some((issue) => issue.field === "wing")).toBe(true);
  });

  it("allows a wing admin to import into their own wing", () => {
    const result = validate({}, { actor: { roles: ["WING_ADMIN"], wingIds: [WING.id] } });
    expect(result.classification).toBe("clean");
  });
});
