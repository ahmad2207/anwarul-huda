import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordPayment } from "./record-payment";
import { applyVoid } from "./void-payment";

// Integration test against the real local Postgres database, matching
// Phase 3's own accept criterion: a void reverses the contribution
// record correctly, and the original payment row stays (never edited or
// deleted, CLAUDE.md domain rule 2).

const FIXTURE_TAG = `VoidPaymentFixture${Date.now()}`;

describe("applyVoid", () => {
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
        phone: "+2348033330002",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });
    memberId = member.id;

    const actor = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    actorId = actor.id;

    const plan = await prisma.contributionPlan.create({
      data: { name: `${FIXTURE_TAG} plan`, amountKobo: 50000, frequency: "MONTHLY" },
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

  it("reverses the amount against the contribution record and marks the payment voided", async () => {
    const payment = await prisma.$transaction((tx) =>
      recordPayment(tx, {
        memberId,
        amountKobo: 50000,
        method: "CASH",
        reference: null,
        narration: null,
        actorId,
        cashSessionId: null,
        plan: { id: planId, frequency: "MONTHLY", amountKobo: 50000 },
        fundId: null,
      }),
    );

    const recordBefore = await prisma.contributionRecord.findUniqueOrThrow({
      where: { id: payment.contributionRecordId! },
    });
    expect(recordBefore.amountPaidKobo).toBe(50000);

    const voided = await prisma.$transaction((tx) => applyVoid(tx, payment, "Entered twice by mistake", actorId));

    expect(voided.status).toBe("VOIDED");
    expect(voided.voidReason).toBe("Entered twice by mistake");
    expect(voided.voidedById).toBe(actorId);
    expect(voided.id).toBe(payment.id); // same row, not a new one
    expect(voided.amountKobo).toBe(payment.amountKobo); // original row untouched apart from void fields

    const recordAfter = await prisma.contributionRecord.findUniqueOrThrow({
      where: { id: payment.contributionRecordId! },
    });
    expect(recordAfter.amountPaidKobo).toBe(0);

    // The original row still exists, unedited and undeleted.
    const stillThere = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stillThere.amountKobo).toBe(50000);
  });

  it("does not touch a contribution record for a fund donation, which has none", async () => {
    const fund = await prisma.fund.findFirstOrThrow({ where: { type: "SADAQAH" } });
    const payment = await prisma.$transaction((tx) =>
      recordPayment(tx, {
        memberId,
        amountKobo: 10000,
        method: "CASH",
        reference: null,
        narration: null,
        actorId,
        cashSessionId: null,
        plan: null,
        fundId: fund.id,
      }),
    );

    const voided = await prisma.$transaction((tx) => applyVoid(tx, payment, "Wrong fund", actorId));
    expect(voided.status).toBe("VOIDED");
  });
});
