import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getZakatBreakdown } from "./zakat-breakdown";

// Integration test against the real local Postgres database, matching
// Phase 4's own accept criterion: the dashboard balances (and, here,
// the zakat category breakdown feeding it) tie out against the
// underlying rows.

const FIXTURE_TAG = `ZakatBreakdownFixture${Date.now()}`;

describe("getZakatBreakdown", () => {
  let fundId: string;
  let actorId: string;

  beforeAll(async () => {
    const actor = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    actorId = actor.id;

    const fund = await prisma.fund.create({ data: { name: `${FIXTURE_TAG} fund`, type: "ZAKAT" } });
    fundId = fund.id;

    const fuqaraCaseA = await prisma.charityCase.create({
      data: {
        reference: `${FIXTURE_TAG}-A`,
        beneficiaryName: "Beneficiary A",
        needDescription: "Need",
        requestedKobo: 100000,
        zakatCategory: "FUQARA",
        status: "APPROVED",
        approvedKobo: 100000,
      },
    });
    const fuqaraCaseB = await prisma.charityCase.create({
      data: {
        reference: `${FIXTURE_TAG}-B`,
        beneficiaryName: "Beneficiary B",
        needDescription: "Need",
        requestedKobo: 50000,
        zakatCategory: "FUQARA",
        status: "APPROVED",
        approvedKobo: 50000,
      },
    });
    const gharimeenCase = await prisma.charityCase.create({
      data: {
        reference: `${FIXTURE_TAG}-C`,
        beneficiaryName: "Beneficiary C",
        needDescription: "Need",
        requestedKobo: 70000,
        zakatCategory: "GHARIMIN",
        status: "APPROVED",
        approvedKobo: 70000,
      },
    });

    await prisma.disbursement.createMany({
      data: [
        {
          reference: `${FIXTURE_TAG}-D1`,
          fundId,
          caseId: fuqaraCaseA.id,
          amountKobo: 60000,
          method: "CASH",
          paidById: actorId,
          paidAt: new Date("2026-05-01T12:00:00.000Z"),
        },
        {
          reference: `${FIXTURE_TAG}-D2`,
          fundId,
          caseId: fuqaraCaseB.id,
          amountKobo: 40000,
          method: "CASH",
          paidById: actorId,
          paidAt: new Date("2026-05-05T12:00:00.000Z"),
        },
        {
          reference: `${FIXTURE_TAG}-D3`,
          fundId,
          caseId: gharimeenCase.id,
          amountKobo: 30000,
          method: "CASH",
          paidById: actorId,
          paidAt: new Date("2026-05-10T12:00:00.000Z"),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.disbursement.deleteMany({ where: { fundId } });
    await prisma.charityCase.deleteMany({ where: { reference: { contains: FIXTURE_TAG } } });
    await prisma.fund.delete({ where: { id: fundId } });
    await prisma.$disconnect();
  });

  it("sums disbursed amounts per category and counts distinct beneficiaries", async () => {
    const breakdown = await getZakatBreakdown(fundId, {
      from: new Date("2026-05-01T00:00:00.000Z"),
      to: new Date("2026-05-31T00:00:00.000Z"),
    });

    const fuqara = breakdown.find((row) => row.category === "FUQARA");
    expect(fuqara?.totalKobo).toBe(100000); // 60000 + 40000, two different cases
    expect(fuqara?.beneficiaryCount).toBe(2);

    const gharimin = breakdown.find((row) => row.category === "GHARIMIN");
    expect(gharimin?.totalKobo).toBe(30000);
    expect(gharimin?.beneficiaryCount).toBe(1);
  });

  it("excludes disbursements outside the period", async () => {
    const breakdown = await getZakatBreakdown(fundId, {
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-30T00:00:00.000Z"),
    });
    expect(breakdown).toEqual([]);
  });
});
