import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordDisbursement } from "./record-disbursement";

// Integration tests against the real local Postgres database, matching
// Phase 4's own accept criterion: the system refuses a zakat
// disbursement without a category. Covers both halves of the rule: the
// service layer check here, and (in the last test) a direct proof that
// the database trigger backstops it even if the service layer were
// bypassed entirely.

const FIXTURE_TAG = `RecordDisbursementFixture${Date.now()}`;

describe("recordDisbursement", () => {
  let actorId: string;
  let zakatFundId: string;
  let sadaqahFundId: string;
  let caseWithCategoryId: string;
  let caseWithoutCategoryId: string;
  let memberId: string;

  beforeAll(async () => {
    const actor = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    actorId = actor.id;

    const zakatFund = await prisma.fund.create({ data: { name: `${FIXTURE_TAG} zakat`, type: "ZAKAT" } });
    zakatFundId = zakatFund.id;
    const sadaqahFund = await prisma.fund.create({ data: { name: `${FIXTURE_TAG} sadaqah`, type: "SADAQAH" } });
    sadaqahFundId = sadaqahFund.id;

    // Both funds need money in them: a disbursement can never take a
    // fund below zero.
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Donor",
        gender: "MALE",
        phone: "+2348066660002",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });
    memberId = member.id;
    for (const [suffix, fundId] of [["Z", zakatFundId], ["S", sadaqahFundId]] as const) {
      await prisma.payment.create({
        data: {
          receiptNumber: `${FIXTURE_TAG}-${suffix}`,
          memberId,
          fundId,
          amountKobo: 200000,
          method: "CASH",
          paidAt: new Date(),
          collectedById: actorId,
        },
      });
    }

    const withCategory = await prisma.charityCase.create({
      data: {
        reference: `${FIXTURE_TAG}-WITH-CAT`,
        beneficiaryName: "Beneficiary A",
        needDescription: "Need",
        requestedKobo: 100000,
        zakatCategory: "FUQARA",
        status: "APPROVED",
        approvedKobo: 100000,
      },
    });
    caseWithCategoryId = withCategory.id;

    const withoutCategory = await prisma.charityCase.create({
      data: {
        reference: `${FIXTURE_TAG}-NO-CAT`,
        beneficiaryName: "Beneficiary B",
        needDescription: "Need",
        requestedKobo: 100000,
        status: "APPROVED",
        approvedKobo: 100000,
      },
    });
    caseWithoutCategoryId = withoutCategory.id;
  });

  afterAll(async () => {
    // Disbursement references are auto-generated sequence numbers
    // (DSB/2026/000123), not tagged with FIXTURE_TAG, so cleanup has to
    // go by the fixture cases' ids instead of by reference.
    const fixtureCases = await prisma.charityCase.findMany({
      where: { reference: { contains: FIXTURE_TAG } },
      select: { id: true },
    });
    await prisma.disbursement.deleteMany({
      where: { caseId: { in: fixtureCases.map((c) => c.id) } },
    });
    await prisma.charityCase.deleteMany({ where: { reference: { contains: FIXTURE_TAG } } });
    await prisma.payment.deleteMany({ where: { memberId } });
    await prisma.member.delete({ where: { id: memberId } });
    await prisma.fund.deleteMany({ where: { id: { in: [zakatFundId, sadaqahFundId] } } });
    await prisma.$disconnect();
  });

  it("refuses a zakat disbursement when the case has no zakat category", async () => {
    const result = await prisma.$transaction((tx) =>
      recordDisbursement(tx, {
        fundId: zakatFundId,
        caseId: caseWithoutCategoryId,
        amountKobo: 50000,
        method: "CASH",
        narration: null,
        evidencePath: null,
        actorId,
      }),
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/zakat category/i);
    }

    const count = await prisma.disbursement.count({ where: { caseId: caseWithoutCategoryId } });
    expect(count).toBe(0);
  });

  it("allows a zakat disbursement when the case has a category, and marks the case disbursed", async () => {
    const result = await prisma.$transaction((tx) =>
      recordDisbursement(tx, {
        fundId: zakatFundId,
        caseId: caseWithCategoryId,
        amountKobo: 50000,
        method: "CASH",
        narration: null,
        evidencePath: null,
        actorId,
      }),
    );

    expect("disbursement" in result).toBe(true);

    const updatedCase = await prisma.charityCase.findUniqueOrThrow({ where: { id: caseWithCategoryId } });
    expect(updatedCase.status).toBe("DISBURSED");
  });

  it("allows a non-zakat disbursement against a case with no zakat category", async () => {
    const otherCase = await prisma.charityCase.create({
      data: {
        reference: `${FIXTURE_TAG}-SADAQAH`,
        beneficiaryName: "Beneficiary C",
        needDescription: "Need",
        requestedKobo: 50000,
        status: "APPROVED",
        approvedKobo: 50000,
      },
    });

    const result = await prisma.$transaction((tx) =>
      recordDisbursement(tx, {
        fundId: sadaqahFundId,
        caseId: otherCase.id,
        amountKobo: 50000,
        method: "CASH",
        narration: null,
        evidencePath: null,
        actorId,
      }),
    );

    expect("disbursement" in result).toBe(true);
  });

  it("refuses a disbursement against a case that has not been approved", async () => {
    const draftCase = await prisma.charityCase.create({
      data: {
        reference: `${FIXTURE_TAG}-DRAFT`,
        beneficiaryName: "Beneficiary D",
        needDescription: "Need",
        requestedKobo: 50000,
        status: "DRAFT",
      },
    });

    const result = await prisma.$transaction((tx) =>
      recordDisbursement(tx, {
        fundId: sadaqahFundId,
        caseId: draftCase.id,
        amountKobo: 50000,
        method: "CASH",
        narration: null,
        evidencePath: null,
        actorId,
      }),
    );

    expect("error" in result).toBe(true);
  });

  it("the database itself refuses an uncategorised zakat disbursement, even bypassing the service layer entirely", async () => {
    // A direct raw insert, skipping recordDisbursement altogether, to
    // prove the trigger added in prisma/migrations is a genuine backstop
    // and not just documentation: even a bug, or a future direct script,
    // that skips the service layer check cannot get an invalid row past
    // the database.
    await expect(
      prisma.$executeRaw`
        INSERT INTO disbursements (id, reference, fund_id, case_id, amount_kobo, method, paid_by_id, paid_at)
        VALUES (
          ${`raw-${FIXTURE_TAG}`},
          ${`${FIXTURE_TAG}-RAW-BYPASS`},
          ${zakatFundId},
          ${caseWithoutCategoryId},
          50000,
          'CASH'::"PaymentMethod",
          ${actorId},
          now()
        )
      `,
    ).rejects.toThrow(/zakat/i);
  });

  it("refuses a disbursement that would take a case past its approved amount", async () => {
    const capped = await prisma.charityCase.create({
      data: {
        reference: `${FIXTURE_TAG}-CAPPED`,
        beneficiaryName: "Beneficiary E",
        needDescription: "Need",
        requestedKobo: 30000,
        status: "APPROVED",
        approvedKobo: 30000,
      },
    });
    const pay = (amountKobo: number) =>
      prisma.$transaction((tx) =>
        recordDisbursement(tx, {
          fundId: sadaqahFundId,
          caseId: capped.id,
          amountKobo,
          method: "CASH",
          narration: null,
          evidencePath: null,
          actorId,
        }),
      );

    expect("disbursement" in (await pay(20000))).toBe(true);
    const over = await pay(20000);
    expect("error" in over).toBe(true);
    if ("error" in over) expect(over.error).toMatch(/approved amount/i);
    expect("disbursement" in (await pay(10000))).toBe(true);

    const total = await prisma.disbursement.aggregate({ where: { caseId: capped.id }, _sum: { amountKobo: true } });
    expect(total._sum.amountKobo).toBe(30000);
  });

  it("refuses a disbursement larger than the fund balance", async () => {
    const bigCase = await prisma.charityCase.create({
      data: {
        reference: `${FIXTURE_TAG}-BIG`,
        beneficiaryName: "Beneficiary F",
        needDescription: "Need",
        requestedKobo: 10000000,
        zakatCategory: "MASAKIN",
        status: "APPROVED",
        approvedKobo: 10000000,
      },
    });

    const result = await prisma.$transaction((tx) =>
      recordDisbursement(tx, {
        fundId: zakatFundId,
        caseId: bigCase.id,
        amountKobo: 5000000,
        method: "CASH",
        narration: null,
        evidencePath: null,
        actorId,
      }),
    );

    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/not enough money in this fund.*Available: ₦/i);
    expect(await prisma.disbursement.count({ where: { caseId: bigCase.id } })).toBe(0);
  });
});
