import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { parseCsvFile } from "./parse-csv";
import { guessColumnMapping } from "./system-fields";
import { computePreview } from "./compute-preview";

// Integration test against the real local Postgres database (see
// vitest.config.mts), matching Phase 2's own acceptance criterion: a
// deliberately messy CSV must produce a preview that correctly separates
// clean, warning and failing rows.

const FIXTURE_SURNAME = `ImportPreviewFixture${Date.now()}`;

const MESSY_CSV = [
  "Surname,First Name,Gender,Phone,Wing,Email,Date of Birth",
  // Clean.
  `${FIXTURE_SURNAME}Clean,Amina,Female,08011110001,Women's wing,amina@example.test,1990-05-01`,
  // Warning: missing email, unparseable date, both optional.
  `${FIXTURE_SURNAME}Warn,Bilkisu,Female,08011110002,Women's wing,,not-a-date`,
  // Fail: missing surname.
  `,Fatima,Female,08011110003,Women's wing,,`,
  // Fail: unrecognisable phone.
  `${FIXTURE_SURNAME}FailPhone,Halima,Female,not-a-phone,Women's wing,,`,
  // Fail: unknown wing.
  `${FIXTURE_SURNAME}FailWing,Zainab,Female,08011110005,Nonexistent Wing,,`,
].join("\n");

function csvFile(content: string): File {
  return new File([content], "members.csv", { type: "text/csv" });
}

describe("computePreview (messy CSV end to end)", () => {
  let existingPhone: string;

  beforeAll(async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } });
    const existing = await prisma.member.create({
      data: {
        surname: `${FIXTURE_SURNAME}Existing`,
        firstName: "Existing",
        gender: "FEMALE",
        phone: "+2348099990000",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });
    existingPhone = existing.phone;
  });

  afterAll(async () => {
    await prisma.member.deleteMany({ where: { surname: { startsWith: FIXTURE_SURNAME } } });
    await prisma.$disconnect();
  });

  it("separates a messy CSV into clean, warning and fail groups", async () => {
    const parsed = await parseCsvFile(csvFile(MESSY_CSV));
    const mapping = guessColumnMapping(parsed.headers);

    const groups = await computePreview(parsed, mapping, { roles: ["SUPER_ADMIN"], wingIds: [] });

    expect(groups.clean).toHaveLength(1);
    expect(groups.clean[0].raw.Surname).toBe(`${FIXTURE_SURNAME}Clean`);

    expect(groups.warning).toHaveLength(1);
    expect(groups.warning[0].raw.Surname).toBe(`${FIXTURE_SURNAME}Warn`);
    expect(groups.warning[0].issues.map((i) => i.field).sort()).toEqual(["dateOfBirth", "email"]);

    expect(groups.fail).toHaveLength(3);
    const failSurnames = groups.fail.map((row) => row.raw.Surname);
    expect(failSurnames).toContain(""); // missing surname row
    expect(failSurnames).toContain(`${FIXTURE_SURNAME}FailPhone`);
    expect(failSurnames).toContain(`${FIXTURE_SURNAME}FailWing`);
  });

  it("flags a row as a duplicate of an existing member by phone", async () => {
    const csv = [
      "Surname,First Name,Gender,Phone,Wing,Email",
      `${FIXTURE_SURNAME}Dup,New Registrant,Female,08099990000,Women's wing,new@example.test`,
    ].join("\n");
    const parsed = await parseCsvFile(csvFile(csv));
    const mapping = guessColumnMapping(parsed.headers);

    const groups = await computePreview(parsed, mapping, { roles: ["SUPER_ADMIN"], wingIds: [] });

    expect(groups.clean).toHaveLength(1);
    expect(groups.clean[0].duplicate?.phone).toBe(existingPhone);
  });
});
