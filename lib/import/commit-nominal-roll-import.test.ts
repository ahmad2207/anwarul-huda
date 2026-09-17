import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { parseCsvFile } from "./parse-csv";
import { guessNominalRollColumnMapping } from "./system-fields";
import { computeNominalRollPreview } from "./compute-nominal-roll-preview";
import { commitNominalRollRows } from "./commit-nominal-roll-import";

// Integration tests against the real local Postgres database, the same
// way commit-import.test.ts exercises the full import's commit inside a
// real transaction.

const FIXTURE_NAME = `NominalRollFixture${Date.now()}`;

function csvFile(content: string): File {
  return new File([content], "roll.csv", { type: "text/csv" });
}

async function makeBatch(actorId: string) {
  return prisma.importBatch.create({
    data: { fileName: "roll.csv", status: "PENDING", mode: "NOMINAL_ROLL", uploadedById: actorId },
  });
}

describe("commitNominalRollRows", () => {
  let actorId: string;
  let wings: Array<{ id: string; numberLetter: string }>;

  beforeAll(async () => {
    const superAdmin = await prisma.user.findFirstOrThrow({
      where: { roles: { some: { role: "SUPER_ADMIN" } } },
    });
    actorId = superAdmin.id;
    wings = await prisma.wing.findMany({ select: { id: true, numberLetter: true } });
  });

  afterAll(async () => {
    await prisma.member.deleteMany({ where: { fullNameAsWritten: { startsWith: FIXTURE_NAME } } });
    await prisma.importBatch.deleteMany({ where: { fileName: "roll.csv", uploadedById: actorId } });
    await prisma.$disconnect();
  });

  it("creates members with no phone, marked incomplete, never inventing a phone number", async () => {
    const csv = [
      "full_name,wing,gender,source_sn,source_page,needs_review",
      `${FIXTURE_NAME} Create,Men's wing,Male,501,1,`,
    ].join("\n");
    const parsed = await parseCsvFile(csvFile(csv));
    const mapping = guessNominalRollColumnMapping(parsed.headers);
    const groups = await computeNominalRollPreview(parsed, mapping, { roles: ["SUPER_ADMIN"], wingIds: [] });
    expect(groups.clean).toHaveLength(1);

    const batch = await makeBatch(actorId);
    const outcome = await prisma.$transaction((tx) => commitNominalRollRows(tx, batch.id, groups, actorId, wings));

    expect(outcome).toEqual({ created: 1, failed: 0, duplicateFlagsRaised: 0 });

    const member = await prisma.member.findFirstOrThrow({
      where: { fullNameAsWritten: `${FIXTURE_NAME} Create` },
    });
    expect(member.phone).toBeNull();
    expect(member.surname).toBeNull();
    expect(member.firstName).toBeNull();
    expect(member.isRecordIncomplete).toBe(true);
    expect(member.status).toBe("ACTIVE");
    expect(member.source).toBe("CSV_IMPORT");
    expect(member.memberNumber).toMatch(/^AHL\/M\/\d{4}\/\d{4}$/);
  });

  it("records an office title appended to a name as officeHeld, not as part of the name", async () => {
    const csv = [
      "full_name,wing,gender,source_sn,source_page,needs_review",
      `${FIXTURE_NAME} Tailor,Men's wing,Male,502,1,job title appended to name`,
    ].join("\n");
    const parsed = await parseCsvFile(csvFile(csv));
    const mapping = guessNominalRollColumnMapping(parsed.headers);
    const groups = await computeNominalRollPreview(parsed, mapping, { roles: ["SUPER_ADMIN"], wingIds: [] });

    const batch = await makeBatch(actorId);
    await prisma.$transaction((tx) => commitNominalRollRows(tx, batch.id, groups, actorId, wings));

    const member = await prisma.member.findFirstOrThrow({ where: { fullNameAsWritten: FIXTURE_NAME } });
    expect(member.officeHeld).toBe("Tailor");
    expect(member.notes).toContain("committee decision");
  });

  it("resolves possible-duplicate S/N cross-references into a single MemberDuplicateFlag pair", async () => {
    const csv = [
      "full_name,wing,gender,source_sn,source_page,needs_review",
      `${FIXTURE_NAME} DupA,Men's wing,Male,601,2,possible duplicate of S/N 602`,
      `${FIXTURE_NAME} DupB,Men's wing,Male,602,2,possible duplicate of S/N 601`,
    ].join("\n");
    const parsed = await parseCsvFile(csvFile(csv));
    const mapping = guessNominalRollColumnMapping(parsed.headers);
    const groups = await computeNominalRollPreview(parsed, mapping, { roles: ["SUPER_ADMIN"], wingIds: [] });
    expect(groups.clean).toHaveLength(2);

    const batch = await makeBatch(actorId);
    const outcome = await prisma.$transaction((tx) => commitNominalRollRows(tx, batch.id, groups, actorId, wings));

    // One flag for the pair, not two, even though both rows note the
    // cross-reference.
    expect(outcome).toEqual({ created: 2, failed: 0, duplicateFlagsRaised: 1 });

    const memberA = await prisma.member.findFirstOrThrow({
      where: { fullNameAsWritten: `${FIXTURE_NAME} DupA` },
    });
    const memberB = await prisma.member.findFirstOrThrow({
      where: { fullNameAsWritten: `${FIXTURE_NAME} DupB` },
    });

    const flags = await prisma.memberDuplicateFlag.findMany({
      where: { OR: [{ memberAId: memberA.id }, { memberBId: memberA.id }] },
    });
    expect(flags).toHaveLength(1);
    expect(flags[0].status).toBe("PENDING");
    expect([flags[0].memberAId, flags[0].memberBId].sort()).toEqual([memberA.id, memberB.id].sort());

    await prisma.memberDuplicateFlag.deleteMany({ where: { id: flags[0].id } });
  });

  it("fails a row missing a required field for this mode, wing, gender or name", async () => {
    const csv = ["full_name,wing,gender,source_sn,source_page,needs_review", ",Men's wing,Male,701,1,"].join("\n");
    const parsed = await parseCsvFile(csvFile(csv));
    const mapping = guessNominalRollColumnMapping(parsed.headers);
    const groups = await computeNominalRollPreview(parsed, mapping, { roles: ["SUPER_ADMIN"], wingIds: [] });
    expect(groups.fail).toHaveLength(1);

    const batch = await makeBatch(actorId);
    const outcome = await prisma.$transaction((tx) => commitNominalRollRows(tx, batch.id, groups, actorId, wings));
    expect(outcome).toEqual({ created: 0, failed: 1, duplicateFlagsRaised: 0 });
  });
});
