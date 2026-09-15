import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeWingAttendanceRate, getMembersNotAttendedSince, resolveWingFilter } from "./reports";

describe("resolveWingFilter", () => {
  it("returns undefined when nothing was requested", () => {
    expect(resolveWingFilter(undefined, null)).toBeUndefined();
  });

  it("honours a requested wing when the user can see all wings", () => {
    expect(resolveWingFilter("wing-1", null)).toBe("wing-1");
  });

  it("honours a requested wing that is within the user's own scope", () => {
    expect(resolveWingFilter("wing-1", ["wing-1", "wing-2"])).toBe("wing-1");
  });

  it("ignores a requested wing outside the user's scope, rather than honouring it", () => {
    expect(resolveWingFilter("wing-9", ["wing-1", "wing-2"])).toBeUndefined();
  });
});

describe("computeWingAttendanceRate", () => {
  it("divides total check-ins by gatherings held times active members", () => {
    const row = computeWingAttendanceRate({
      wingId: "w1",
      wingName: "Men's",
      gatheringsHeld: 4,
      totalCheckIns: 120,
      activeMemberCount: 50,
    });
    // 120 / (4 * 50) = 0.6 -> 60%
    expect(row.ratePercent).toBeCloseTo(60);
  });

  it("reads as 0 percent rather than throwing when no gatherings were held", () => {
    const row = computeWingAttendanceRate({
      wingId: "w1",
      wingName: "Men's",
      gatheringsHeld: 0,
      totalCheckIns: 0,
      activeMemberCount: 50,
    });
    expect(row.ratePercent).toBe(0);
  });

  it("reads as 0 percent rather than dividing by zero when the wing has no active members", () => {
    const row = computeWingAttendanceRate({
      wingId: "w1",
      wingName: "Men's",
      gatheringsHeld: 3,
      totalCheckIns: 0,
      activeMemberCount: 0,
    });
    expect(row.ratePercent).toBe(0);
  });
});

// Integration test against the real local Postgres database: the "not
// attended since" filter is a relation "none" query, worth proving
// against real rows rather than trusting the Prisma query shape reads.
const FIXTURE_TAG = `InactiveFixture${Date.now()}`;

describe("getMembersNotAttendedSince", () => {
  let wingId: string;
  let gatheringId: string;
  let recentAttendeeId: string;
  let staleAttendeeId: string;
  let neverAttendedId: string;

  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
  const cutoffFourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  beforeAll(async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "YOUTH" } });
    wingId = wing.id;

    const gathering = await prisma.gathering.create({
      data: { title: `${FIXTURE_TAG} gathering`, type: "TALEEM", startsAt: eightWeeksAgo, wingId },
    });
    gatheringId = gathering.id;

    const [recent, stale, never] = await Promise.all([
      prisma.member.create({
        data: {
          surname: FIXTURE_TAG,
          firstName: "Recent",
          gender: "MALE",
          phone: "+2348077771001",
          status: "ACTIVE",
          source: "ADMIN_ENTRY",
          wingId,
        },
      }),
      prisma.member.create({
        data: {
          surname: FIXTURE_TAG,
          firstName: "Stale",
          gender: "MALE",
          phone: "+2348077771002",
          status: "ACTIVE",
          source: "ADMIN_ENTRY",
          wingId,
        },
      }),
      prisma.member.create({
        data: {
          surname: FIXTURE_TAG,
          firstName: "Never",
          gender: "MALE",
          phone: "+2348077771003",
          status: "ACTIVE",
          source: "ADMIN_ENTRY",
          wingId,
        },
      }),
    ]);
    recentAttendeeId = recent.id;
    staleAttendeeId = stale.id;
    neverAttendedId = never.id;

    await prisma.attendanceRecord.createMany({
      data: [
        { gatheringId, memberId: recentAttendeeId, checkedInAt: twoWeeksAgo, method: "MANUAL" },
        { gatheringId, memberId: staleAttendeeId, checkedInAt: eightWeeksAgo, method: "MANUAL" },
      ],
    });
  });

  afterAll(async () => {
    await prisma.attendanceRecord.deleteMany({ where: { gatheringId } });
    await prisma.gathering.delete({ where: { id: gatheringId } });
    await prisma.member.deleteMany({ where: { surname: FIXTURE_TAG } });
    await prisma.$disconnect();
  });

  it("excludes a member who attended within the cutoff window", async () => {
    const { rows } = await getMembersNotAttendedSince({
      cutoff: cutoffFourWeeksAgo,
      scope: [wingId],
      page: 1,
      pageSize: 50,
    });
    expect(rows.some((row) => row.memberId === recentAttendeeId)).toBe(false);
  });

  it("includes a member whose last attendance is older than the cutoff", async () => {
    const { rows } = await getMembersNotAttendedSince({
      cutoff: cutoffFourWeeksAgo,
      scope: [wingId],
      page: 1,
      pageSize: 50,
    });
    const row = rows.find((r) => r.memberId === staleAttendeeId);
    expect(row).toBeDefined();
    expect(row?.lastAttendedAt?.getTime()).toBe(eightWeeksAgo.getTime());
  });

  it("includes a member who has never attended, with a null last attended date", async () => {
    const { rows } = await getMembersNotAttendedSince({
      cutoff: cutoffFourWeeksAgo,
      scope: [wingId],
      page: 1,
      pageSize: 50,
    });
    const row = rows.find((r) => r.memberId === neverAttendedId);
    expect(row).toBeDefined();
    expect(row?.lastAttendedAt).toBeNull();
  });
});
