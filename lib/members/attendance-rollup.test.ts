import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { lagosMidnightUtc } from "@/lib/timezone";
import { getAttendanceRollup } from "./attendance-rollup";
import { CharityHistoryAccessError, getMemberCharityHistory } from "./charity-history";

// Integration tests against the real database. The rollup's gatherings
// sit in 2098, with the period and "now" injected there, so no real
// gathering can fall inside it.

const FIXTURE_TAG = `RollupFixture${Date.now()}`;
const PERIOD = { from: lagosMidnightUtc(2098, 1, 1), to: lagosMidnightUtc(2099, 1, 1) };
const NOW = lagosMidnightUtc(2098, 6, 15);

let ownWingId: string;
let otherWingId: string;
let memberId: string;

beforeAll(async () => {
  ownWingId = (await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } })).id;
  otherWingId = (await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } })).id;
  memberId = (
    await prisma.member.create({
      data: { surname: FIXTURE_TAG, firstName: "Rollup", gender: "MALE", status: "ACTIVE", source: "ADMIN_ENTRY", wingId: ownWingId },
    })
  ).id;
});

afterAll(async () => {
  const gatheringWhere = { title: { startsWith: FIXTURE_TAG } };
  await prisma.attendanceRecord.deleteMany({ where: { gathering: gatheringWhere } });
  await prisma.gathering.deleteMany({ where: gatheringWhere });
  await prisma.member.deleteMany({ where: { surname: FIXTURE_TAG } });
  await prisma.$disconnect();
});

describe("getAttendanceRollup", () => {
  it("counts held against attended per type, within the period, in the member's scope, never beyond now", async () => {
    async function gathering(type: "JUMUAH" | "TALEEM", startsAt: Date, wingId: string | null, attended: boolean) {
      const created = await prisma.gathering.create({
        data: { title: `${FIXTURE_TAG} ${type}`, type, startsAt, wingId },
      });
      if (attended) {
        await prisma.attendanceRecord.create({
          data: { gatheringId: created.id, memberId, checkedInAt: startsAt, method: "MANUAL" },
        });
      }
    }

    await gathering("JUMUAH", lagosMidnightUtc(2098, 3, 6), ownWingId, true);
    await gathering("JUMUAH", lagosMidnightUtc(2098, 3, 13), null, true); // open to all wings
    await gathering("JUMUAH", lagosMidnightUtc(2098, 3, 20), ownWingId, false);
    await gathering("TALEEM", lagosMidnightUtc(2098, 4, 4), ownWingId, false);
    await gathering("TALEEM", lagosMidnightUtc(2098, 4, 11), otherWingId, true); // another wing: neither held nor attended
    await gathering("JUMUAH", lagosMidnightUtc(2097, 12, 25), ownWingId, true); // before the period
    await gathering("JUMUAH", lagosMidnightUtc(2098, 7, 3), ownWingId, false); // after "now": not yet held

    const rollup = await getAttendanceRollup({ id: memberId, wingId: ownWingId }, PERIOD, NOW);
    expect(rollup).toEqual([
      { type: "JUMUAH", held: 3, attended: 2 },
      { type: "TALEEM", held: 1, attended: 0 },
    ]);
  });
});

describe("getMemberCharityHistory", () => {
  it("refuses a wing admin before touching the database", async () => {
    await expect(getMemberCharityHistory({ roles: ["WING_ADMIN"] }, memberId)).rejects.toBeInstanceOf(
      CharityHistoryAccessError,
    );
  });

  it("returns the member's cases to a charity officer", async () => {
    const rows = await getMemberCharityHistory({ roles: ["CHARITY_OFFICER"] }, memberId);
    expect(rows).toEqual([]); // no cases for this fixture member: allowed, and empty
  });
});
