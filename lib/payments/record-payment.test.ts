import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { computePeriod } from "@/lib/contributions/period";
import { recordPayment, RecordPaymentError } from "./record-payment";
import { listPayablePeriods } from "./payable-periods";

// Integration tests against the real local Postgres database (see
// vitest.config.mts), matching Phase 3's own accept criterion: a payment
// updates the contribution record it was applied to.

const FIXTURE_TAG = `RecordPaymentFixture${Date.now()}`;

describe("recordPayment", () => {
  let memberId: string;
  let actorId: string;
  let planId: string;

  beforeAll(async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Payer",
        gender: "MALE",
        phone: "+2348033330001",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });
    memberId = member.id;

    const actor = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    actorId = actor.id;

    const plan = await prisma.contributionPlan.create({
      data: {
        name: `${FIXTURE_TAG} plan`,
        amountKobo: 50000,
        frequency: "MONTHLY",
      },
    });
    planId = plan.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { memberId } });
    await prisma.contributionRecord.deleteMany({ where: { memberId } });
    await prisma.contributionPlan.delete({ where: { id: planId } });
    await prisma.member.delete({ where: { id: memberId } });
    await prisma.$disconnect();
  });

  it("creates the contribution record on demand and adds the amount to it", async () => {
    const payment = await prisma.$transaction((tx) =>
      recordPayment(tx, {
        memberId,
        amountKobo: 20000,
        method: "CASH",
        reference: null,
        narration: null,
        actorId,
        cashSessionId: null,
        plan: { id: planId, frequency: "MONTHLY", amountKobo: 50000 },
        fundId: null,
      }),
    );

    expect(payment.receiptNumber).toMatch(/^RCT\/\d{4}\/\d{6}$/);
    expect(payment.contributionRecordId).not.toBeNull();

    const period = computePeriod("MONTHLY");
    const record = await prisma.contributionRecord.findUniqueOrThrow({
      where: { memberId_planId_periodLabel: { memberId, planId, periodLabel: period.periodLabel } },
    });
    expect(record.amountDueKobo).toBe(50000);
    expect(record.amountPaidKobo).toBe(20000);
  });

  it("adds a second payment to the same period's record rather than creating a new one", async () => {
    await prisma.$transaction((tx) =>
      recordPayment(tx, {
        memberId,
        amountKobo: 30000,
        method: "CASH",
        reference: null,
        narration: null,
        actorId,
        cashSessionId: null,
        plan: { id: planId, frequency: "MONTHLY", amountKobo: 50000 },
        fundId: null,
      }),
    );

    const period = computePeriod("MONTHLY");
    const records = await prisma.contributionRecord.findMany({
      where: { memberId, planId, periodLabel: period.periodLabel },
    });
    expect(records).toHaveLength(1);
    expect(records[0].amountPaidKobo).toBe(50000); // 20000 + 30000 from both tests
  });

  it("records a fund donation with no contribution record at all", async () => {
    const fund = await prisma.fund.findFirstOrThrow({ where: { type: "SADAQAH" } });

    const payment = await prisma.$transaction((tx) =>
      recordPayment(tx, {
        memberId,
        amountKobo: 10000,
        method: "POS",
        reference: "POS-TEST-1",
        narration: null,
        actorId,
        cashSessionId: null,
        plan: null,
        fundId: fund.id,
      }),
    );

    expect(payment.contributionRecordId).toBeNull();
    expect(payment.fundId).toBe(fund.id);
  });
  it("settles an earlier period in arrears when the officer chooses it, not the current one", async () => {
    const plan = { id: planId, frequency: "MONTHLY" as const, amountKobo: 50000 };
    const august = await prisma.contributionRecord.create({
      data: {
        memberId,
        planId,
        periodLabel: "2001-08",
        periodStart: new Date("2001-07-31T23:00:00Z"),
        periodEnd: new Date("2001-08-31T23:00:00Z"),
        amountDueKobo: 50000,
      },
    });

    const offered = await listPayablePeriods(prisma, memberId, plan);
    expect(offered[0]).toEqual({ periodLabel: "2001-08", outstandingKobo: 50000, isCurrent: false });
    expect(offered.at(-1)?.isCurrent).toBe(true);

    const payment = await prisma.$transaction((tx) =>
      recordPayment(tx, {
        memberId,
        amountKobo: 50000,
        method: "BANK_TRANSFER",
        reference: "ARREARS-1",
        narration: null,
        actorId,
        cashSessionId: null,
        plan,
        periodLabel: "2001-08",
        fundId: null,
      }),
    );

    expect(payment.contributionRecordId).toBe(august.id);
    const settled = await prisma.contributionRecord.findUniqueOrThrow({ where: { id: august.id } });
    expect(settled.amountPaidKobo).toBe(50000);

    const afterwards = await listPayablePeriods(prisma, memberId, plan);
    expect(afterwards.some((period) => period.periodLabel === "2001-08")).toBe(false);
  });

  it("refuses a period that has nothing due, writing no payment", async () => {
    const before = await prisma.payment.count({ where: { memberId } });

    await expect(
      prisma.$transaction((tx) =>
        recordPayment(tx, {
          memberId,
          amountKobo: 50000,
          method: "BANK_TRANSFER",
          reference: "NOTHING-DUE",
          narration: null,
          actorId,
          cashSessionId: null,
          plan: { id: planId, frequency: "MONTHLY", amountKobo: 50000 },
          periodLabel: "1999-01",
          fundId: null,
        }),
      ),
    ).rejects.toThrow(RecordPaymentError);

    expect(await prisma.payment.count({ where: { memberId } })).toBe(before);
  });
});
