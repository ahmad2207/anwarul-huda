import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getFundBalance } from "./fund-balance";

// Integration test against the real local Postgres database: this is a
// money calculation with real consequences (Phase 4's own accept
// criterion is that the dashboard balances tie out against the
// underlying rows), so it is worth verifying against real aggregation
// rather than trusting it by inspection.

const FIXTURE_TAG = `FundBalanceFixture${Date.now()}`;

describe("getFundBalance", () => {
  let fundId: string;
  let memberId: string;
  let actorId: string;
  let caseId: string;

  beforeAll(async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Donor",
        gender: "MALE",
        phone: "+2348066660001",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });
    memberId = member.id;

    const actor = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    actorId = actor.id;

    const fund = await prisma.fund.create({
      data: { name: `${FIXTURE_TAG} fund`, type: "SADAQAH" },
    });
    fundId = fund.id;

    const charityCase = await prisma.charityCase.create({
      data: {
        reference: `${FIXTURE_TAG}-CASE`,
        beneficiaryName: "Test Beneficiary",
        needDescription: "Test need",
        requestedKobo: 100000,
        status: "APPROVED",
        approvedKobo: 100000,
      },
    });
    caseId = charityCase.id;
  });

  afterAll(async () => {
    await prisma.disbursement.deleteMany({ where: { fundId } });
    await prisma.payment.deleteMany({ where: { fundId } });
    await prisma.charityCase.delete({ where: { id: caseId } });
    await prisma.fund.delete({ where: { id: fundId } });
    await prisma.member.delete({ where: { id: memberId } });
    await prisma.$disconnect();
  });

  it("computes opening zero, received, disbursed and closing balance with no period bound", async () => {
    await prisma.payment.create({
      data: {
        receiptNumber: `${FIXTURE_TAG}-R1`,
        memberId,
        fundId,
        amountKobo: 100000,
        method: "CASH",
        paidAt: new Date("2026-01-15T12:00:00.000Z"),
        collectedById: actorId,
      },
    });
    await prisma.disbursement.create({
      data: {
        reference: `${FIXTURE_TAG}-D1`,
        fundId,
        caseId,
        amountKobo: 40000,
        method: "CASH",
        paidById: actorId,
        paidAt: new Date("2026-02-01T12:00:00.000Z"),
      },
    });

    const balance = await getFundBalance(fundId);
    expect(balance.openingBalanceKobo).toBe(0);
    expect(balance.receivedKobo).toBe(100000);
    expect(balance.disbursedKobo).toBe(40000);
    expect(balance.closingBalanceKobo).toBe(60000);
    expect(balance.beneficiaryCount).toBe(1);
  });

  it("carries prior activity into the opening balance for a later period", async () => {
    // Everything above happened in Jan/Feb 2026. A period starting in
    // March should show that as its opening balance, not as received or
    // disbursed within the period.
    const balance = await getFundBalance(fundId, { from: new Date("2026-03-01T00:00:00.000Z") });
    expect(balance.openingBalanceKobo).toBe(60000);
    expect(balance.receivedKobo).toBe(0);
    expect(balance.disbursedKobo).toBe(0);
    expect(balance.closingBalanceKobo).toBe(60000);
  });

  it("excludes a voided payment from received", async () => {
    const voidedPayment = await prisma.payment.create({
      data: {
        receiptNumber: `${FIXTURE_TAG}-R2`,
        memberId,
        fundId,
        amountKobo: 500000,
        method: "CASH",
        paidAt: new Date("2026-04-01T12:00:00.000Z"),
        collectedById: actorId,
        status: "VOIDED",
        voidedById: actorId,
        voidedAt: new Date(),
        voidReason: "Test",
      },
    });

    const balance = await getFundBalance(fundId, {
      from: new Date("2026-04-01T00:00:00.000Z"),
      to: new Date("2026-04-30T00:00:00.000Z"),
    });
    expect(balance.receivedKobo).toBe(0);

    await prisma.payment.delete({ where: { id: voidedPayment.id } });
  });

  it("bounds a period at both ends and ties out against the underlying rows", async () => {
    const balance = await getFundBalance(fundId, {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-31T23:59:59.000Z"),
    });
    expect(balance.openingBalanceKobo).toBe(0);
    expect(balance.receivedKobo).toBe(100000); // only the January payment
    expect(balance.disbursedKobo).toBe(0); // the disbursement was in February
    expect(balance.closingBalanceKobo).toBe(100000);
  });
});
