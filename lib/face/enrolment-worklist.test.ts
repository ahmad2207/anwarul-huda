import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { EnrolmentWorklistError, getEnrolmentWorklist, recordWillNotUseFaceCheckIn } from "./enrolment-worklist";

// Integration tests against the real database. Every query searches by
// this run's fixture tag, so real members on the worklist never affect the
// results.

const FIXTURE_TAG = `EnrolmentWorklistFixture${Date.now()}`;
const NOW = new Date("2026-09-26T10:00:00.000Z");
const ADULT = new Date("1990-01-01T00:00:00.000Z");
const CHILD = new Date("2015-01-01T00:00:00.000Z");

let mensWingId: string;
let womensWingId: string;
let officerId: string;
const memberIds: Record<string, string> = {};

async function makeMember(
  key: string,
  data: { dateOfBirth?: Date | null; faceEnrolmentDeferred?: boolean; faceCheckInExcluded?: boolean; status?: "ACTIVE" | "INACTIVE" } = {},
) {
  const member = await prisma.member.create({
    data: {
      surname: FIXTURE_TAG,
      firstName: key,
      gender: "MALE",
      source: "ADMIN_ENTRY",
      wingId: mensWingId,
      status: data.status ?? "ACTIVE",
      dateOfBirth: data.dateOfBirth === undefined ? ADULT : data.dateOfBirth,
      faceEnrolmentDeferred: data.faceEnrolmentDeferred ?? false,
      faceCheckInExcluded: data.faceCheckInExcluded ?? false,
      consentBiometric: true,
      completedSections: ["NAME", "ABOUT", "CONTACT", "HOUSEHOLD", "MEMBERSHIP", "SERVICE", "NEXT_OF_KIN", "CONSENT"],
    },
  });
  memberIds[key] = member.id;
  return member.id;
}

function officer(wingIds: string[]) {
  return { id: officerId, roles: ["ATTENDANCE_OFFICER" as const], wingIds };
}

async function listedNames(wingIds: string[], filter: "all" | "deferred" | "never" = "all") {
  const { members } = await getEnrolmentWorklist(officer(wingIds), { filter, search: FIXTURE_TAG }, { page: 1, pageSize: 50 }, NOW);
  return members.map((member) => member.firstName);
}

beforeAll(async () => {
  mensWingId = (await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } })).id;
  womensWingId = (await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } })).id;
  officerId = (await prisma.user.create({ data: { email: `${FIXTURE_TAG.toLowerCase()}@example.invalid` } })).id;

  await makeMember("Deferred", { faceEnrolmentDeferred: true });
  await makeMember("NeverStarted");
  await makeMember("NoBirthDate", { dateOfBirth: null });
  await makeMember("UnderEighteen", { dateOfBirth: CHILD });
  await makeMember("AlreadyExcluded", { faceCheckInExcluded: true });
  await makeMember("Inactive", { status: "INACTIVE" });
  const enrolled = await makeMember("Enrolled");
  const embedding = new Array(1024).fill(0);
  embedding[900] = 1;
  await prisma.$executeRaw`
    INSERT INTO face_enrolments (id, member_id, embedding, liveness_score, enrolled_at, is_active)
    VALUES (${`${FIXTURE_TAG}-enrolment`}, ${enrolled}, ${`[${embedding.join(",")}]`}::vector, 0.9, ${NOW}, true)
  `;
});

afterAll(async () => {
  const ids = Object.values(memberIds);
  await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.faceEnrolment.deleteMany({ where: { memberId: { in: ids } } });
  await prisma.member.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.delete({ where: { id: officerId } });
  await prisma.$disconnect();
});

describe("getEnrolmentWorklist", () => {
  it("lists active adults with no face set up, members who asked for help first", async () => {
    const names = await listedNames([mensWingId]);
    expect(names[0]).toBe("Deferred");
    expect(names.sort()).toEqual(["Deferred", "NeverStarted", "NoBirthDate"]);
  });

  it("leaves off under 18s, the enrolled, the excluded and inactive members", async () => {
    const names = await listedNames([mensWingId]);
    for (const absent of ["UnderEighteen", "Enrolled", "AlreadyExcluded", "Inactive"]) {
      expect(names).not.toContain(absent);
    }
  });

  it("filters to those who asked for help, or those who never started", async () => {
    expect(await listedNames([mensWingId], "deferred")).toEqual(["Deferred"]);
    expect((await listedNames([mensWingId], "never")).sort()).toEqual(["NeverStarted", "NoBirthDate"]);
  });

  it("shows an officer nothing from a wing they do not cover", async () => {
    expect(await listedNames([womensWingId])).toEqual([]);
  });
});

describe("recordWillNotUseFaceCheckIn", () => {
  it("refuses an officer from another wing", async () => {
    await expect(recordWillNotUseFaceCheckIn(officer([womensWingId]), memberIds.NeverStarted, null)).rejects.toBeInstanceOf(
      EnrolmentWorklistError,
    );
  });

  it("takes the member off the list for good and never leaves the record incomplete because of face", async () => {
    await recordWillNotUseFaceCheckIn(officer([mensWingId]), memberIds.Deferred, "Observes niqab");

    const member = await prisma.member.findUniqueOrThrow({ where: { id: memberIds.Deferred } });
    expect(member.faceCheckInExcluded).toBe(true);
    expect(member.faceEnrolmentDeferred).toBe(false);
    expect(member.consentBiometric).toBe(false);
    expect(member.completedSections).toContain("FACE");
    expect(await listedNames([mensWingId])).not.toContain("Deferred");

    await expect(recordWillNotUseFaceCheckIn(officer([mensWingId]), memberIds.Deferred, null)).rejects.toThrow(
      "already checked in by name",
    );
  });
});
