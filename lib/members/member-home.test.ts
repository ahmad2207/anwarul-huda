import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { lagosMidnightUtc } from "@/lib/timezone";
import { getAttendanceSummary, getAttentionItems, getUpcomingGatherings } from "./member-home";

// Integration tests against the real database. Gatherings are placed in
// 2099, with "now" injected there too, so no real gathering can land in
// the window these queries look at.

const FIXTURE_TAG = `MemberHomeFixture${Date.now()}`;
const NOW = lagosMidnightUtc(2099, 6, 15);
const ALL_SECTIONS = [
  "NAME",
  "ABOUT",
  "CONTACT",
  "HOUSEHOLD",
  "MEMBERSHIP",
  "SERVICE",
  "NEXT_OF_KIN",
  "CONSENT",
  "FACE",
] as const;

let ownWingId: string;
let otherWingId: string;
let planId: string | null = null;

function hoursFromNow(hours: number): Date {
  return new Date(NOW.getTime() + hours * 60 * 60 * 1000);
}

async function createMember(firstName: string, overrides: { completedSections?: (typeof ALL_SECTIONS)[number][]; faceEnrolmentDeferred?: boolean } = {}) {
  return prisma.member.create({
    data: {
      surname: FIXTURE_TAG,
      firstName,
      gender: "MALE",
      status: "ACTIVE",
      source: "ADMIN_ENTRY",
      wingId: ownWingId,
      completedSections: overrides.completedSections ?? [...ALL_SECTIONS],
      faceEnrolmentDeferred: overrides.faceEnrolmentDeferred ?? false,
    },
  });
}

async function createGathering(title: string, startsAt: Date, extra: { wingId?: string | null; endsAt?: Date; isClosed?: boolean } = {}) {
  return prisma.gathering.create({
    data: {
      title: `${FIXTURE_TAG} ${title}`,
      type: "TALEEM",
      startsAt,
      endsAt: extra.endsAt ?? null,
      wingId: extra.wingId === undefined ? ownWingId : extra.wingId,
      isClosed: extra.isClosed ?? false,
    },
  });
}

beforeAll(async () => {
  ownWingId = (await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } })).id;
  otherWingId = (await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } })).id;
});

afterAll(async () => {
  const gatheringWhere = { title: { startsWith: FIXTURE_TAG } };
  await prisma.attendanceRecord.deleteMany({ where: { gathering: gatheringWhere } });
  await prisma.gathering.deleteMany({ where: gatheringWhere });
  if (planId) {
    await prisma.contributionRecord.deleteMany({ where: { planId } });
    await prisma.contributionPlan.delete({ where: { id: planId } });
  }
  await prisma.member.deleteMany({ where: { surname: FIXTURE_TAG } });
  await prisma.$disconnect();
});

describe("getAttentionItems", () => {
  it("returns nothing outstanding for a complete, paid up member", async () => {
    const member = await createMember("Clear");
    const items = await getAttentionItems(member);
    expect(items).toEqual({ balance: null, nextRecordSection: null, faceAwaitingSetup: false });
  });

  it("totals unpaid periods and dates the balance from the oldest one", async () => {
    const member = await createMember("Owing");
    const plan = await prisma.contributionPlan.create({
      data: { name: `${FIXTURE_TAG} dues`, amountKobo: 250000, frequency: "MONTHLY", isActive: true },
    });
    planId = plan.id;
    const july = lagosMidnightUtc(2099, 7, 1);
    const august = lagosMidnightUtc(2099, 8, 1);
    const september = lagosMidnightUtc(2099, 9, 1);
    await prisma.contributionRecord.createMany({
      data: [
        // Paid in full: not part of the balance, and not the "since".
        { memberId: member.id, planId, periodLabel: "2099-06", periodStart: lagosMidnightUtc(2099, 6, 1), periodEnd: july, amountDueKobo: 250000, amountPaidKobo: 250000 },
        { memberId: member.id, planId, periodLabel: "2099-07", periodStart: july, periodEnd: august, amountDueKobo: 250000, amountPaidKobo: 100000 },
        { memberId: member.id, planId, periodLabel: "2099-08", periodStart: august, periodEnd: september, amountDueKobo: 250000, amountPaidKobo: 0 },
      ],
    });

    const { balance } = await getAttentionItems(member);
    expect(balance).toEqual({ totalKobo: 400000, planNames: [`${FIXTURE_TAG} dues`], since: july });
  });

  it("names the next section when the record is not finished", async () => {
    const member = await createMember("Partial", { completedSections: ["NAME", "ABOUT"] });
    const { nextRecordSection } = await getAttentionItems(member);
    expect(nextRecordSection?.section).toBe("CONTACT");
  });

  it("flags face setup only while deferred with no enrolment", async () => {
    const member = await createMember("Deferred", { faceEnrolmentDeferred: true });
    expect((await getAttentionItems(member)).faceAwaitingSetup).toBe(true);
  });
});

describe("getUpcomingGatherings", () => {
  it("returns the next two in the member's wing or open to all, skipping closed, ended, other wings and ones already attended", async () => {
    const member = await createMember("Attender");

    await createGathering("ended", hoursFromNow(-3), { endsAt: hoursFromNow(-1) });
    const inProgress = await createGathering("in progress", hoursFromNow(-1), { endsAt: hoursFromNow(1) });
    await createGathering("other wing", hoursFromNow(2), { wingId: otherWingId });
    await createGathering("closed", hoursFromNow(3), { isClosed: true });
    const attended = await createGathering("already attended", hoursFromNow(4));
    const allWings = await createGathering("all wings", hoursFromNow(5), { wingId: null });
    await createGathering("third", hoursFromNow(6));

    await prisma.attendanceRecord.create({
      data: { gatheringId: attended.id, memberId: member.id, checkedInAt: NOW, method: "MANUAL" },
    });

    const upcoming = await getUpcomingGatherings(member, NOW);
    expect(upcoming.map((gathering) => gathering.id)).toEqual([inProgress.id, allWings.id]);
  });
});

describe("getAttendanceSummary", () => {
  it("counts gatherings held so far this month against those attended, with the last check-in date", async () => {
    const member = await createMember("Counter");
    const { attendedThisMonth: attendedBefore, heldThisMonth: heldBefore } = await getAttendanceSummary(member, NOW);

    const lastMonth = await createGathering("last month", lagosMidnightUtc(2099, 5, 20));
    const early = await createGathering("early June", lagosMidnightUtc(2099, 6, 2));
    await createGathering("mid June", lagosMidnightUtc(2099, 6, 9));
    const otherWing = await createGathering("other wing June", lagosMidnightUtc(2099, 6, 10), { wingId: otherWingId });
    await createGathering("later June", lagosMidnightUtc(2099, 6, 20));

    const lastCheckIn = lagosMidnightUtc(2099, 6, 10);
    await prisma.attendanceRecord.createMany({
      data: [
        { gatheringId: lastMonth.id, memberId: member.id, checkedInAt: lagosMidnightUtc(2099, 5, 20), method: "MANUAL" },
        { gatheringId: early.id, memberId: member.id, checkedInAt: lagosMidnightUtc(2099, 6, 2), method: "MANUAL" },
        // Another wing's gathering: never counted, so "attended" cannot exceed "held".
        { gatheringId: otherWing.id, memberId: member.id, checkedInAt: lastCheckIn, method: "MANUAL" },
      ],
    });

    const summary = await getAttendanceSummary(member, NOW);
    expect(summary.heldThisMonth - heldBefore).toBe(2); // early and mid June; later June has not happened yet
    expect(summary.attendedThisMonth - attendedBefore).toBe(1);
    expect(summary.lastAttendedAt).toEqual(lastCheckIn);
  });
});
