import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { lagosMidnightUtc } from "@/lib/timezone";
import {
  getAttendanceLog,
  getAttendanceStats,
  getMemberActivity,
  getMemberMoneyTotals,
  MemberActivityAccessError,
} from "./member-view";

// Integration tests against the real database. Dates sit in 2097 so no
// real gathering or check-in falls inside the periods used here.

const FIXTURE_TAG = `MemberViewFixture${Date.now()}`;
const PERIOD = { from: lagosMidnightUtc(2097, 1, 1), to: lagosMidnightUtc(2098, 1, 1) };

let memberId: string;
let officerId: string;
let planId: string;

beforeAll(async () => {
  const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
  memberId = (
    await prisma.member.create({
      data: { surname: FIXTURE_TAG, firstName: "Viewed", gender: "MALE", status: "ACTIVE", source: "ADMIN_ENTRY", wingId: wing.id },
    })
  ).id;
  officerId = (await prisma.user.create({ data: { email: `${FIXTURE_TAG.toLowerCase()}@example.invalid` } })).id;
  planId = (
    await prisma.contributionPlan.create({
      data: { name: `${FIXTURE_TAG} dues`, amountKobo: 100000, frequency: "MONTHLY", isActive: true },
    })
  ).id;

  async function checkIn(day: number, method: "MANUAL" | "FACE") {
    const startsAt = lagosMidnightUtc(2097, 3, day);
    const gathering = await prisma.gathering.create({
      data: { title: `${FIXTURE_TAG} day ${day}`, type: "JUMUAH", startsAt, wingId: wing.id },
    });
    await prisma.attendanceRecord.create({
      data: {
        gatheringId: gathering.id,
        memberId,
        checkedInAt: startsAt,
        method,
        recordedById: method === "MANUAL" ? officerId : null,
      },
    });
  }
  await checkIn(1, "MANUAL");
  await checkIn(8, "FACE");
  await checkIn(29, "MANUAL"); // 21 days after the previous one: the longest gap
});

afterAll(async () => {
  const gatheringWhere = { title: { startsWith: FIXTURE_TAG } };
  await prisma.attendanceRecord.deleteMany({ where: { gathering: gatheringWhere } });
  await prisma.gathering.deleteMany({ where: gatheringWhere });
  await prisma.payment.deleteMany({ where: { memberId } });
  await prisma.contributionRecord.deleteMany({ where: { planId } });
  await prisma.contributionPlan.delete({ where: { id: planId } });
  await prisma.auditLog.deleteMany({ where: { entityId: memberId } });
  await prisma.member.deleteMany({ where: { surname: FIXTURE_TAG } });
  await prisma.user.delete({ where: { id: officerId } });
  await prisma.$disconnect();
});

describe("getAttendanceLog", () => {
  it("lists check-ins newest first, naming the officer only for a manual one", async () => {
    const { rows, total } = await getAttendanceLog(memberId, PERIOD, { page: 1, pageSize: 10 });
    expect(total).toBe(3);
    expect(rows.map((row) => row.method)).toEqual(["MANUAL", "FACE", "MANUAL"]);
    expect(rows[0].recordedBy).toBe(`${FIXTURE_TAG.toLowerCase()}@example.invalid`);
    expect(rows[1].recordedBy).toBeNull();
  });

  it("pages the log", async () => {
    const { rows, total } = await getAttendanceLog(memberId, PERIOD, { page: 2, pageSize: 2 });
    expect(total).toBe(3);
    expect(rows).toHaveLength(1);
  });
});

describe("getAttendanceStats", () => {
  it("reports the longest gap between consecutive check-ins and the methods used", async () => {
    const stats = await getAttendanceStats(memberId, PERIOD);
    expect(stats.longestGapDays).toBe(21);
    expect(stats.methodCounts).toEqual({ MANUAL: 2, FACE: 1 });
    expect(stats.isFaceEnrolled).toBe(false);
  });
});

describe("getMemberMoneyTotals", () => {
  it("never counts a voided payment, and never lets one period's overpayment cancel another's arrears", async () => {
    await prisma.contributionRecord.createMany({
      data: [
        { memberId, planId, periodLabel: "2097-01", periodStart: lagosMidnightUtc(2097, 1, 1), periodEnd: lagosMidnightUtc(2097, 2, 1), amountDueKobo: 100000, amountPaidKobo: 150000 },
        { memberId, planId, periodLabel: "2097-02", periodStart: lagosMidnightUtc(2097, 2, 1), periodEnd: lagosMidnightUtc(2097, 3, 1), amountDueKobo: 100000, amountPaidKobo: 40000 },
      ],
    });
    await prisma.payment.createMany({
      data: [
        { receiptNumber: `${FIXTURE_TAG}-1`, memberId, amountKobo: 190000, method: "CASH", paidAt: lagosMidnightUtc(2097, 2, 5), collectedById: officerId },
        {
          receiptNumber: `${FIXTURE_TAG}-2`,
          memberId,
          amountKobo: 50000,
          method: "CASH",
          paidAt: lagosMidnightUtc(2097, 2, 6),
          collectedById: officerId,
          status: "VOIDED",
          voidedById: officerId,
          voidedAt: lagosMidnightUtc(2097, 2, 6),
          voidReason: "Entered twice",
        },
      ],
    });

    expect(await getMemberMoneyTotals(memberId)).toEqual({ totalPaidKobo: 190000, arrearsKobo: 60000 });
  });
});

describe("getMemberActivity", () => {
  it("refuses anyone but a super admin before reading anything", async () => {
    await expect(
      getMemberActivity({ roles: ["WING_ADMIN"] }, { id: memberId, userId: null }, { page: 1, pageSize: 10 }),
    ).rejects.toBeInstanceOf(MemberActivityAccessError);
  });

  it("returns this member's audit entries, newest first, to a super admin", async () => {
    await prisma.auditLog.create({
      data: { actorId: officerId, action: "member.updated", entity: "Member", entityId: memberId, after: { occupation: "Teacher" } },
    });
    const { entries, total } = await getMemberActivity(
      { roles: ["SUPER_ADMIN"] },
      { id: memberId, userId: null },
      { page: 1, pageSize: 10 },
    );
    expect(total).toBe(1);
    expect(entries[0].action).toBe("member.updated");
  });
});
