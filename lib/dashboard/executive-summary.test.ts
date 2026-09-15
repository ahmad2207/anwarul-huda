import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getLagosDateParts, lagosMidnightUtc } from "@/lib/timezone";
import { computePeriod } from "@/lib/contributions/period";
import { getAttendanceTrend, getCollectionSummary, getMembershipSummary } from "./executive-summary";

// Integration tests against the real local Postgres database. Each
// compares a before/after delta around the real function calls, rather
// than asserting an absolute count, since these functions summarise the
// whole database and other fixtures or seed data are free to exist
// alongside whatever a given test adds.

const FIXTURE_TAG = `ExecSummaryFixture${Date.now()}`;

describe("getMembershipSummary", () => {
  let wingId: string;

  beforeAll(async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "YOUTH" } });
    wingId = wing.id;
  });

  afterAll(async () => {
    await prisma.member.deleteMany({ where: { surname: FIXTURE_TAG } });
    await prisma.$disconnect();
  });

  it("counts a member created this month as new, but not one backdated to last month", async () => {
    const before = await getMembershipSummary();
    const beforeRow = before.find((row) => row.wingId === wingId)!;

    const { year, month } = getLagosDateParts();
    const lastMonth = lagosMidnightUtc(year, month - 1, 15);

    await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "ThisMonth",
        gender: "MALE",
        phone: "+2348066660001",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId,
      },
    });
    await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "LastMonth",
        gender: "MALE",
        phone: "+2348066660002",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId,
        createdAt: lastMonth,
      },
    });

    const after = await getMembershipSummary();
    const afterRow = after.find((row) => row.wingId === wingId)!;

    expect(afterRow.activeCount - beforeRow.activeCount).toBe(2); // both are active members
    expect(afterRow.newThisMonth - beforeRow.newThisMonth).toBe(1); // only the one created this month
  });
});

describe("getCollectionSummary", () => {
  let planId: string;

  afterAll(async () => {
    await prisma.contributionRecord.deleteMany({ where: { planId } });
    await prisma.contributionPlan.delete({ where: { id: planId } });
    await prisma.$disconnect();
  });

  it("reports total due, total paid and the rate for the plan's current period", async () => {
    const plan = await prisma.contributionPlan.create({
      data: { name: `${FIXTURE_TAG} plan`, amountKobo: 100000, frequency: "MONTHLY", isActive: true },
    });
    planId = plan.id;
    const period = computePeriod("MONTHLY");

    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Payer",
        gender: "MALE",
        phone: "+2348066660003",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });

    await prisma.contributionRecord.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        periodLabel: period.periodLabel,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        amountDueKobo: 100000,
        amountPaidKobo: 40000,
      },
    });

    const summary = await getCollectionSummary();
    const row = summary.find((r) => r.planId === plan.id);
    expect(row).toBeDefined();
    expect(row?.periodLabel).toBe(period.periodLabel);
    expect(row?.totalDueKobo).toBe(100000);
    expect(row?.totalPaidKobo).toBe(40000);
    expect(row?.ratePercent).toBeCloseTo(40);

    // The record depends on the member, so it goes first.
    await prisma.contributionRecord.deleteMany({ where: { memberId: member.id } });
    await prisma.member.delete({ where: { id: member.id } });
  });

  it("reads as 0 due and 0 percent, not an error, when nothing has been generated for the current period yet", async () => {
    const plan = await prisma.contributionPlan.create({
      data: { name: `${FIXTURE_TAG} unused plan`, amountKobo: 50000, frequency: "MONTHLY", isActive: true },
    });

    const summary = await getCollectionSummary();
    const row = summary.find((r) => r.planId === plan.id);
    expect(row).toBeDefined();
    expect(row?.totalDueKobo).toBe(0);
    expect(row?.ratePercent).toBe(0);

    await prisma.contributionPlan.delete({ where: { id: plan.id } });
  });
});

describe("getAttendanceTrend", () => {
  let gatheringId: string;

  afterAll(async () => {
    await prisma.attendanceRecord.deleteMany({ where: { gatheringId } });
    await prisma.gathering.delete({ where: { id: gatheringId } });
    await prisma.$disconnect();
  });

  it("counts a check-in from today in the most recent week's bucket", async () => {
    const before = await getAttendanceTrend(8);
    const currentWeekBefore = before[before.length - 1].checkIns;

    const gathering = await prisma.gathering.create({
      data: { title: `${FIXTURE_TAG} gathering`, type: "JUMUAH", startsAt: new Date() },
    });
    gatheringId = gathering.id;

    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Attendee",
        gender: "MALE",
        phone: "+2348066660004",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });

    await prisma.attendanceRecord.create({
      data: { gatheringId: gathering.id, memberId: member.id, checkedInAt: new Date(), method: "MANUAL" },
    });

    const after = await getAttendanceTrend(8);
    expect(after).toHaveLength(8);
    expect(after[after.length - 1].checkIns - currentWeekBefore).toBe(1);

    // The record depends on the member, so it goes first.
    await prisma.attendanceRecord.deleteMany({ where: { memberId: member.id } });
    await prisma.member.delete({ where: { id: member.id } });
  });
});
