import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { parseCsvFile } from "./parse-csv";
import { guessColumnMapping } from "./system-fields";
import { computePreview } from "./compute-preview";
import { commitImportRows } from "./commit-import";
import { rollbackImportBatch } from "./rollback-import";

// Integration tests against the real local Postgres database (see
// vitest.config.mts). These exercise the exact transaction Phase 2's
// commit and rollback steps run in production.

const FIXTURE_SURNAME = `ImportCommitFixture${Date.now()}`;

function csvFile(content: string): File {
  return new File([content], "members.csv", { type: "text/csv" });
}

async function makeBatch(actorId: string) {
  return prisma.importBatch.create({
    data: { fileName: "test.csv", status: "PENDING", uploadedById: actorId },
  });
}

describe("commitImportRows and rollbackImportBatch", () => {
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
    await prisma.member.deleteMany({ where: { surname: { startsWith: FIXTURE_SURNAME } } });
    await prisma.importBatch.deleteMany({ where: { fileName: "test.csv", uploadedById: actorId } });
    await prisma.$disconnect();
  });

  it("creates members with issued member numbers and links them to the batch", async () => {
    const csv = [
      "Surname,First Name,Gender,Phone,Wing,Email",
      `${FIXTURE_SURNAME}Create,Amina,Female,08011119001,Women's wing,amina@example.test`,
    ].join("\n");
    const parsed = await parseCsvFile(csvFile(csv));
    const mapping = guessColumnMapping(parsed.headers);
    const groups = await computePreview(parsed, mapping, { roles: ["SUPER_ADMIN"], wingIds: [] });
    expect(groups.clean).toHaveLength(1);

    const batch = await makeBatch(actorId);
    const outcome = await prisma.$transaction((tx) =>
      commitImportRows(tx, batch.id, groups, {}, actorId, wings),
    );

    expect(outcome).toEqual({ created: 1, updated: 0, skipped: 0, failed: 0 });

    const member = await prisma.member.findFirstOrThrow({
      where: { surname: `${FIXTURE_SURNAME}Create` },
    });
    expect(member.status).toBe("ACTIVE");
    expect(member.source).toBe("CSV_IMPORT");
    expect(member.importBatchId).toBe(batch.id);
    expect(member.memberNumber).toMatch(/^AHL\/W\/\d{4}\/\d{4}$/);
  });

  it("defaults an unspecified duplicate to skip, writing nothing", async () => {
    const wing = wings[0];
    const existing = await prisma.member.create({
      data: {
        surname: `${FIXTURE_SURNAME}DupTarget`,
        firstName: "Existing",
        gender: "FEMALE",
        phone: "+2348011119002",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });

    const csv = [
      "Surname,First Name,Gender,Phone,Wing,Email",
      `${FIXTURE_SURNAME}DupRow,New Name,Female,08011119002,Women's wing,newname@example.test`,
    ].join("\n");
    const parsed = await parseCsvFile(csvFile(csv));
    const mapping = guessColumnMapping(parsed.headers);
    const groups = await computePreview(parsed, mapping, { roles: ["SUPER_ADMIN"], wingIds: [] });
    expect(groups.clean[0]?.duplicate?.id).toBe(existing.id);

    const batch = await makeBatch(actorId);
    const outcome = await prisma.$transaction((tx) =>
      commitImportRows(tx, batch.id, groups, {}, actorId, wings),
    );

    expect(outcome).toEqual({ created: 0, updated: 0, skipped: 1, failed: 0 });
    const stillOnlyOne = await prisma.member.count({ where: { phone: "+2348011119002" } });
    expect(stillOnlyOne).toBe(1);
  });

  it("updates the existing member when the duplicate action is update, without touching its wing", async () => {
    const wing = wings[0];
    const existing = await prisma.member.create({
      data: {
        surname: `${FIXTURE_SURNAME}UpdateTarget`,
        firstName: "Existing",
        gender: "FEMALE",
        phone: "+2348011119003",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
        occupation: "Old occupation",
      },
    });

    const csv = [
      "Surname,First Name,Gender,Phone,Wing,Occupation,Email",
      `${FIXTURE_SURNAME}UpdateTarget,Existing,Female,08011119003,Women's wing,New occupation,existing@example.test`,
    ].join("\n");
    const parsed = await parseCsvFile(csvFile(csv));
    const mapping = guessColumnMapping(parsed.headers);
    const groups = await computePreview(parsed, mapping, { roles: ["SUPER_ADMIN"], wingIds: [] });

    const batch = await makeBatch(actorId);
    const outcome = await prisma.$transaction((tx) =>
      commitImportRows(tx, batch.id, groups, { [groups.clean[0].rowNumber]: "update" }, actorId, wings),
    );

    expect(outcome).toEqual({ created: 0, updated: 1, skipped: 0, failed: 0 });

    const updated = await prisma.member.findUniqueOrThrow({ where: { id: existing.id } });
    expect(updated.occupation).toBe("New occupation");
    expect(updated.wingId).toBe(wing.id); // unchanged
    expect(updated.source).toBe("ADMIN_ENTRY"); // unchanged, this was not (re)created
  });

  it("creates a second member anyway when the duplicate action is create", async () => {
    const wing = wings[0];
    await prisma.member.create({
      data: {
        surname: `${FIXTURE_SURNAME}CreateAnywayTarget`,
        firstName: "Existing",
        gender: "FEMALE",
        phone: "+2348011119004",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });

    const csv = [
      "Surname,First Name,Gender,Phone,Wing,Email",
      `${FIXTURE_SURNAME}CreateAnywayTarget,Existing,Female,08011119004,Women's wing,existing2@example.test`,
    ].join("\n");
    const parsed = await parseCsvFile(csvFile(csv));
    const mapping = guessColumnMapping(parsed.headers);
    const groups = await computePreview(parsed, mapping, { roles: ["SUPER_ADMIN"], wingIds: [] });

    const batch = await makeBatch(actorId);
    const outcome = await prisma.$transaction((tx) =>
      commitImportRows(tx, batch.id, groups, { [groups.clean[0].rowNumber]: "create" }, actorId, wings),
    );

    expect(outcome).toEqual({ created: 1, updated: 0, skipped: 0, failed: 0 });
    const count = await prisma.member.count({ where: { phone: "+2348011119004" } });
    expect(count).toBe(2);
  });

  it("rolls back a batch with no activity, removing every member it created", async () => {
    const csv = [
      "Surname,First Name,Gender,Phone,Wing",
      `${FIXTURE_SURNAME}Rollback,Amina,Female,08011119005,Women's wing`,
    ].join("\n");
    const parsed = await parseCsvFile(csvFile(csv));
    const mapping = guessColumnMapping(parsed.headers);
    const groups = await computePreview(parsed, mapping, { roles: ["SUPER_ADMIN"], wingIds: [] });

    const batch = await makeBatch(actorId);
    await prisma.$transaction((tx) => commitImportRows(tx, batch.id, groups, {}, actorId, wings));

    const before = await prisma.member.count({ where: { importBatchId: batch.id } });
    expect(before).toBe(1);

    const result = await prisma.$transaction((tx) => rollbackImportBatch(tx, batch.id, actorId));

    expect(result.blockers).toBeUndefined();
    expect(result.removedCount).toBe(1);
    const after = await prisma.member.count({ where: { importBatchId: batch.id } });
    expect(after).toBe(0);
  });

  it("refuses to roll back a batch whose member has a payment recorded", async () => {
    const wing = wings[0];
    const plan = await prisma.contributionPlan.findFirstOrThrow();
    const batch = await makeBatch(actorId);

    const member = await prisma.member.create({
      data: {
        surname: `${FIXTURE_SURNAME}HasPayment`,
        firstName: "Amina",
        gender: "FEMALE",
        phone: "+2348011119006",
        status: "ACTIVE",
        source: "CSV_IMPORT",
        wingId: wing.id,
        importBatchId: batch.id,
      },
    });

    await prisma.payment.create({
      data: {
        receiptNumber: `TEST-${Date.now()}`,
        memberId: member.id,
        planId: plan.id,
        amountKobo: 50000,
        method: "CASH",
        paidAt: new Date(),
        collectedById: actorId,
      },
    });

    const result = await prisma.$transaction((tx) => rollbackImportBatch(tx, batch.id, actorId));

    expect(result.removedCount).toBeUndefined();
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers?.[0].reason).toBe("payments");

    const stillThere = await prisma.member.findUnique({ where: { id: member.id } });
    expect(stillThere).not.toBeNull();

    await prisma.payment.deleteMany({ where: { memberId: member.id } });
  });
});
