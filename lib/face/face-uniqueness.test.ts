import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveEnrolmentForMember } from "./save-enrolment";
import { resolveFaceMatchCase, FaceMatchReviewError } from "./match-cases";
import { matchFaceForCheckIn } from "./match-face";

// Integration tests against the real database, for the enrolment,
// review and check-in paths of face uniqueness
// (MEMBER-HOME-AND-ADMIN-VIEW.md 3). Needs the face_uniqueness migration.
//
// Embeddings are built from two one-hot directions, so the cosine
// similarity between any two is exactly known. Each test uses its own
// indices, which no real face embedding lines up with closely enough to
// reach the detection threshold.
//
// runRetrospectiveScan is deliberately not called here: it compares every
// enrolled face in the database, and against a shared database it would
// open review cases for real members.

const FIXTURE_TAG = `FaceUniquenessFixture${Date.now()}`;
const memberIds: string[] = [];

function unit(index: number): number[] {
  const vector = new Array(1024).fill(0);
  vector[index] = 1;
  return vector;
}

/** A unit vector at exactly `similarity` to unit(base), leaning towards unit(other). */
function near(base: number, other: number, similarity: number): number[] {
  const vector = new Array(1024).fill(0);
  vector[base] = similarity;
  vector[other] = Math.sqrt(1 - similarity * similarity);
  return vector;
}

let mensWingId: string;
let womensWingId: string;
let reviewerId: string;

async function makeMember(suffix: string, wingId: string = mensWingId) {
  const member = await prisma.member.create({
    data: {
      surname: `${FIXTURE_TAG}${suffix}`,
      firstName: "Test",
      gender: "MALE",
      status: "ACTIVE",
      source: "ADMIN_ENTRY",
      wingId,
      consentBiometric: true,
      completedSections: ["NAME", "ABOUT", "CONTACT", "HOUSEHOLD", "MEMBERSHIP", "SERVICE", "NEXT_OF_KIN", "CONSENT"],
    },
  });
  memberIds.push(member.id);
  return member.id;
}

function enrol(memberId: string, embedding: number[]) {
  return saveEnrolmentForMember({
    memberId,
    embedding,
    livenessScore: 0.9,
    deviceLabel: null,
    actorId: reviewerId,
    officerAssisted: false,
  });
}

beforeAll(async () => {
  mensWingId = (await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } })).id;
  womensWingId = (await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } })).id;
  reviewerId = (await prisma.user.create({ data: { email: `${FIXTURE_TAG.toLowerCase()}@example.invalid` } })).id;
});

afterAll(async () => {
  const cases = await prisma.faceMatchCase.findMany({
    where: { OR: [{ memberAId: { in: memberIds } }, { memberBId: { in: memberIds } }] },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...memberIds, ...cases.map((matchCase) => matchCase.id)] } },
  });
  await prisma.faceMatchCase.deleteMany({ where: { id: { in: cases.map((matchCase) => matchCase.id) } } });
  await prisma.faceEnrolment.deleteMany({ where: { memberId: { in: memberIds } } });
  await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
  await prisma.user.delete({ where: { id: reviewerId } });
  await prisma.$disconnect();
});

describe("saveEnrolmentForMember", () => {
  it("saves a face nobody else is close to, and replaces it on re-enrolment", async () => {
    const memberId = await makeMember("Alone");
    expect(await enrol(memberId, unit(100))).toEqual({ kind: "saved", isReEnrolment: false });
    expect(await enrol(memberId, near(100, 101, 0.95))).toEqual({ kind: "saved", isReEnrolment: true });
    expect(await prisma.faceEnrolment.count({ where: { memberId } })).toBe(1);
  });

  it("holds a face too close to another member's, saves nothing, opens one case, and defers the member", async () => {
    const enrolled = await makeMember("Brother");
    const enrolling = await makeMember("OtherBrother");
    await enrol(enrolled, unit(110));

    // 0.46: below the check-in threshold of 0.5, above detection at 0.45.
    expect(await enrol(enrolling, near(110, 111, 0.46))).toEqual({ kind: "held_for_review" });
    expect(await enrol(enrolling, near(110, 111, 0.46))).toEqual({ kind: "held_for_review" });

    expect(await prisma.faceEnrolment.count({ where: { memberId: enrolling } })).toBe(0);
    const cases = await prisma.faceMatchCase.findMany({ where: { memberAId: enrolling } });
    expect(cases).toHaveLength(1); // trying again does not open a second case
    expect(cases[0]).toMatchObject({ memberBId: enrolled, status: "OPEN", source: "ENROLMENT" });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: enrolling } })).faceEnrolmentDeferred).toBe(true);
  });

  it("lets the member enrol once the pair is dismissed as not a real match", async () => {
    const enrolled = await makeMember("Lookalike");
    const enrolling = await makeMember("Dismissed");
    await enrol(enrolled, unit(120));
    await enrol(enrolling, near(120, 121, 0.6));

    const matchCase = await prisma.faceMatchCase.findFirstOrThrow({ where: { memberAId: enrolling } });
    await resolveFaceMatchCase(
      { id: reviewerId, roles: ["SUPER_ADMIN"], wingIds: [] },
      matchCase.id,
      "DISMISSED",
      "Checked in person: clearly different",
    );

    expect(await enrol(enrolling, near(120, 121, 0.6))).toEqual({ kind: "saved", isReEnrolment: false });
  });
});

describe("resolveFaceMatchCase", () => {
  it("excludes both members for good when they are different people", async () => {
    const enrolled = await makeMember("TwinA");
    const enrolling = await makeMember("TwinB");
    await enrol(enrolled, unit(130));
    await enrol(enrolling, near(130, 131, 0.9));
    const matchCase = await prisma.faceMatchCase.findFirstOrThrow({ where: { memberAId: enrolling } });

    await resolveFaceMatchCase(
      { id: reviewerId, roles: ["SUPER_ADMIN"], wingIds: [] },
      matchCase.id,
      "INDISTINGUISHABLE",
      "Identical twins",
    );

    for (const memberId of [enrolled, enrolling]) {
      const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
      expect(member.faceCheckInExcluded).toBe(true);
      expect(member.faceEnrolmentDeferred).toBe(false);
      expect(member.completedSections).toContain("FACE");
      expect(await prisma.faceEnrolment.count({ where: { memberId } })).toBe(0);
    }
    expect(await enrol(enrolling, unit(132))).toEqual({ kind: "excluded" });
  });

  it("refuses a decision without a reason, a second decision, and a pair outside an attendance officer's wings", async () => {
    const enrolled = await makeMember("CrossWingA", womensWingId);
    const enrolling = await makeMember("CrossWingB");
    await enrol(enrolled, unit(140));
    await enrol(enrolling, near(140, 141, 0.7));
    const matchCase = await prisma.faceMatchCase.findFirstOrThrow({ where: { memberAId: enrolling } });

    const officer = { id: reviewerId, roles: ["ATTENDANCE_OFFICER" as const], wingIds: [mensWingId] };
    await expect(resolveFaceMatchCase(officer, matchCase.id, "DISMISSED", "Not them")).rejects.toBeInstanceOf(
      FaceMatchReviewError,
    );

    const superAdmin = { id: reviewerId, roles: ["SUPER_ADMIN" as const], wingIds: [] };
    await expect(resolveFaceMatchCase(superAdmin, matchCase.id, "SAME_PERSON", "   ")).rejects.toThrow(
      "Give a reason",
    );
    await resolveFaceMatchCase(superAdmin, matchCase.id, "SAME_PERSON", "Registered twice");
    await expect(resolveFaceMatchCase(superAdmin, matchCase.id, "DISMISSED", "Changed my mind")).rejects.toThrow(
      "already been decided",
    );
  });
});

describe("matchFaceForCheckIn margin", () => {
  it("refuses a close call between two enrolled members rather than picking one", async () => {
    // Two members enrolled directly, bypassing detection, the way a pair
    // enrolled before this feature existed would be.
    const first = await makeMember("CloseA");
    const second = await makeMember("CloseB");
    for (const [memberId, embedding] of [
      [first, near(150, 151, 0.99)],
      [second, near(150, 152, 0.99)],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO face_enrolments (id, member_id, embedding, liveness_score, enrolled_at, is_active)
        VALUES (${`${FIXTURE_TAG}${memberId}`}, ${memberId}, ${`[${embedding.join(",")}]`}::vector, 0.9, ${new Date()}, true)
      `;
    }

    const result = await matchFaceForCheckIn(unit(150), mensWingId);
    expect(result.kind).toBe("ambiguous");
  });
});
