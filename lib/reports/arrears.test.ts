import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getArrearsReport } from "./arrears";

// Integration test against the real local Postgres database: this is raw
// SQL (a column-to-column comparison Prisma's query builder cannot
// express), so it is worth checking directly rather than trusting it by
// inspection.

const FIXTURE_TAG = `ArrearsFixture${Date.now()}`;

describe("getArrearsReport", () => {
  let wingId: string;
  let memberInArrearsId: string;
  let memberPaidUpId: string;
  let inactiveMemberId: string;
  let planId: string;

  beforeAll(async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "YOUTH" } });
    wingId = wing.id;

    const plan = await prisma.contributionPlan.create({
      data: { name: `${FIXTURE_TAG} plan`, amountKobo: 50000, frequency: "MONTHLY" },
    });
    planId = plan.id;

    const inArrears = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Owes",
        gender: "MALE",
        phone: "+2348055550001",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId,
      },
    });
    memberInArrearsId = inArrears.id;
    await prisma.contributionRecord.create({
      data: {
        memberId: inArrears.id,
        planId,
        periodLabel: `${FIXTURE_TAG}-P1`,
        periodStart: new Date(),
        periodEnd: new Date(),
        amountDueKobo: 50000,
        amountPaidKobo: 20000, // 30000 outstanding
      },
    });

    const paidUp = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "PaidUp",
        gender: "MALE",
        phone: "+2348055550002",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId,
      },
    });
    memberPaidUpId = paidUp.id;
    await prisma.contributionRecord.create({
      data: {
        memberId: paidUp.id,
        planId,
        periodLabel: `${FIXTURE_TAG}-P1`,
        periodStart: new Date(),
        periodEnd: new Date(),
        amountDueKobo: 50000,
        amountPaidKobo: 50000, // fully paid, not in arrears
      },
    });

    const inactive = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Inactive",
        gender: "MALE",
        phone: "+2348055550003",
        status: "INACTIVE",
        statusReason: "Test fixture",
        statusAt: new Date(),
        source: "ADMIN_ENTRY",
        wingId,
      },
    });
    inactiveMemberId = inactive.id;
    await prisma.contributionRecord.create({
      data: {
        memberId: inactive.id,
        planId,
        periodLabel: `${FIXTURE_TAG}-P1`,
        periodStart: new Date(),
        periodEnd: new Date(),
        amountDueKobo: 50000,
        amountPaidKobo: 0, // owes, but inactive, should not appear
      },
    });
  });

  afterAll(async () => {
    await prisma.contributionRecord.deleteMany({ where: { planId } });
    await prisma.member.deleteMany({ where: { surname: FIXTURE_TAG } });
    await prisma.contributionPlan.delete({ where: { id: planId } });
    await prisma.$disconnect();
  });

  it("lists an active member with an unpaid balance and the correct outstanding total", async () => {
    const rows = await getArrearsReport(wingId);
    const row = rows.find((r) => r.memberId === memberInArrearsId);
    expect(row).toBeDefined();
    expect(row?.outstandingKobo).toBe(30000);
    expect(row?.recordCount).toBe(1);
  });

  it("excludes a member who has paid in full", async () => {
    const rows = await getArrearsReport(wingId);
    expect(rows.find((r) => r.memberId === memberPaidUpId)).toBeUndefined();
  });

  it("excludes an inactive member even though they owe money", async () => {
    const rows = await getArrearsReport(wingId);
    expect(rows.find((r) => r.memberId === inactiveMemberId)).toBeUndefined();
  });

  it("filters by wing", async () => {
    const otherWing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    const rows = await getArrearsReport(otherWing.id);
    expect(rows.find((r) => r.memberId === memberInArrearsId)).toBeUndefined();
  });
});
