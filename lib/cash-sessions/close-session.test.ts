import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordPayment } from "@/lib/payments/record-payment";
import { closeSession } from "./close-session";

// Integration test against the real local Postgres database, matching
// Phase 3's own accept criterion: a cash session with a deliberate
// shortfall reports the right variance.

const FIXTURE_TAG = `CloseSessionFixture${Date.now()}`;

describe("closeSession", () => {
  let memberId: string;
  let actorId: string;

  beforeAll(async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Payer",
        gender: "MALE",
        phone: "+2348033330003",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });
    memberId = member.id;

    const actor = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    actorId = actor.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { memberId } });
    await prisma.cashSession.deleteMany({ where: { label: { startsWith: FIXTURE_TAG } } });
    await prisma.member.delete({ where: { id: memberId } });
    await prisma.$disconnect();
  });

  it("computes zero variance when the counted cash matches exactly", async () => {
    const session = await prisma.cashSession.create({
      data: {
        label: `${FIXTURE_TAG} exact`,
        openedById: actorId,
        openedAt: new Date(),
        openingFloatKobo: 100000, // N1,000 float
        status: "OPEN",
      },
    });

    await prisma.$transaction((tx) =>
      recordPayment(tx, {
        memberId,
        amountKobo: 50000,
        method: "CASH",
        reference: null,
        narration: null,
        actorId,
        cashSessionId: session.id,
        plan: null,
        fundId: null,
      }),
    );

    // Expected: 100000 float + 50000 cash = 150000.
    const result = await prisma.$transaction((tx) => closeSession(tx, session, 150000, null, actorId));

    expect("error" in result).toBe(false);
    if ("session" in result) {
      expect(result.session.expectedCashKobo).toBe(150000);
      expect(result.session.countedCashKobo).toBe(150000);
      expect(result.session.varianceKobo).toBe(0);
      expect(result.session.status).toBe("CLOSED");
    }
  });

  it("refuses a non-zero variance with no note, and reports the right shortfall once given one", async () => {
    const session = await prisma.cashSession.create({
      data: {
        label: `${FIXTURE_TAG} shortfall`,
        openedById: actorId,
        openedAt: new Date(),
        openingFloatKobo: 0,
        status: "OPEN",
      },
    });

    await prisma.$transaction((tx) =>
      recordPayment(tx, {
        memberId,
        amountKobo: 200000, // N2,000 expected
        method: "CASH",
        reference: null,
        narration: null,
        actorId,
        cashSessionId: session.id,
        plan: null,
        fundId: null,
      }),
    );

    // A deliberate N500 shortfall: only 150000 kobo counted against
    // 200000 expected.
    const refused = await prisma.$transaction((tx) => closeSession(tx, session, 150000, null, actorId));
    expect("error" in refused).toBe(true);

    const stillOpen = await prisma.cashSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(stillOpen.status).toBe("OPEN");

    const result = await prisma.$transaction((tx) =>
      closeSession(tx, session, 150000, "Till was N500 short, counted twice", actorId),
    );
    expect("error" in result).toBe(false);
    if ("session" in result) {
      expect(result.session.expectedCashKobo).toBe(200000);
      expect(result.session.countedCashKobo).toBe(150000);
      expect(result.session.varianceKobo).toBe(-50000);
      expect(result.session.varianceNote).toBe("Till was N500 short, counted twice");
    }
  });

  it("refuses to close an already closed session", async () => {
    const session = await prisma.cashSession.create({
      data: {
        label: `${FIXTURE_TAG} already-closed`,
        openedById: actorId,
        openedAt: new Date(),
        closedById: actorId,
        closedAt: new Date(),
        openingFloatKobo: 0,
        countedCashKobo: 0,
        expectedCashKobo: 0,
        varianceKobo: 0,
        status: "CLOSED",
      },
    });

    const result = await prisma.$transaction((tx) => closeSession(tx, session, 0, null, actorId));
    expect("error" in result).toBe(true);
  });

  it("only counts confirmed cash payments toward the expected total, never a voided one", async () => {
    const session = await prisma.cashSession.create({
      data: {
        label: `${FIXTURE_TAG} voided-excluded`,
        openedById: actorId,
        openedAt: new Date(),
        openingFloatKobo: 0,
        status: "OPEN",
      },
    });

    const payment = await prisma.$transaction((tx) =>
      recordPayment(tx, {
        memberId,
        amountKobo: 30000,
        method: "CASH",
        reference: null,
        narration: null,
        actorId,
        cashSessionId: session.id,
        plan: null,
        fundId: null,
      }),
    );
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "VOIDED" } });

    const result = await prisma.$transaction((tx) => closeSession(tx, session, 0, null, actorId));
    expect("error" in result).toBe(false);
    if ("session" in result) {
      expect(result.session.expectedCashKobo).toBe(0);
    }
  });
});
