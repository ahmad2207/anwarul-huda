import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { CalibrationError, recordCalibrationSample } from "./calibration";

// Integration test against the real database: a sample is scored against
// the enrolled faces and only the scores are stored. Needs the
// face_calibration migration. Embeddings use one-hot directions no real
// face lines up with, so real enrolments never come near these scores.

const FIXTURE_TAG = `CalibrationFixture${Date.now()}`;
const memberIds: string[] = [];
let wingId: string;
let gatheringId: string;
let actorId: string;

function unit(index: number): number[] {
  const vector = new Array(1024).fill(0);
  vector[index] = 1;
  return vector;
}

function near(base: number, other: number, similarity: number): number[] {
  const vector = new Array(1024).fill(0);
  vector[base] = similarity;
  vector[other] = Math.sqrt(1 - similarity * similarity);
  return vector;
}

async function makeMember(key: string, consent = true) {
  const member = await prisma.member.create({
    data: { surname: `${FIXTURE_TAG}${key}`, firstName: "Test", gender: "MALE", status: "ACTIVE", source: "ADMIN_ENTRY", wingId, consentBiometric: consent },
  });
  memberIds.push(member.id);
  return member.id;
}

async function enrol(memberId: string, embedding: number[]) {
  await prisma.$executeRaw`
    INSERT INTO face_enrolments (id, member_id, embedding, liveness_score, enrolled_at, is_active)
    VALUES (${`${FIXTURE_TAG}${memberId}`}, ${memberId}, ${`[${embedding.join(",")}]`}::vector, 0.9, ${new Date()}, true)
  `;
}

beforeAll(async () => {
  wingId = (await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } })).id;
  gatheringId = (await prisma.gathering.create({ data: { title: `${FIXTURE_TAG} gathering`, type: "JUMUAH", startsAt: new Date(), wingId } })).id;
  actorId = (await prisma.user.create({ data: { email: `${FIXTURE_TAG.toLowerCase()}@example.invalid` } })).id;
});

afterAll(async () => {
  const samples = await prisma.faceCalibrationSample.findMany({ where: { gatheringId }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: samples.map((sample) => sample.id) } } });
  await prisma.faceCalibrationSample.deleteMany({ where: { gatheringId } });
  await prisma.faceEnrolment.deleteMany({ where: { memberId: { in: memberIds } } });
  await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
  await prisma.gathering.delete({ where: { id: gatheringId } });
  await prisma.user.delete({ where: { id: actorId } });
  await prisma.$disconnect();
});

describe("recordCalibrationSample", () => {
  it("stores the genuine score and the two closest other scores, and nothing of the capture itself", async () => {
    const subject = await makeMember("Subject");
    const lookalike = await makeMember("Lookalike");
    await enrol(subject, unit(700));
    await enrol(lookalike, unit(701));

    const capture = near(700, 701, 0.8); // 0.8 to the subject, 0.6 to the look-alike
    const scores = await recordCalibrationSample(
      { id: actorId, roles: ["SUPER_ADMIN"] },
      { gatheringId, memberId: subject, embedding: capture, livenessScore: 0.9 },
    );

    expect(scores.genuineSimilarity).toBeCloseTo(0.8, 5);
    expect(scores.bestImpostorSimilarity).toBeCloseTo(0.6, 5);

    const stored = await prisma.faceCalibrationSample.findFirstOrThrow({ where: { gatheringId, memberId: subject } });
    expect(stored.genuineSimilarity).toBeCloseTo(0.8, 5);
    expect(Object.keys(stored)).not.toContain("embedding");
  });

  it("records a member with no enrolment as a stranger, with no genuine score", async () => {
    const stranger = await makeMember("Stranger");
    const scores = await recordCalibrationSample(
      { id: actorId, roles: ["SUPER_ADMIN"] },
      { gatheringId, memberId: stranger, embedding: unit(702), livenessScore: 0.9 },
    );
    expect(scores.genuineSimilarity).toBeNull();
  });

  it("refuses anyone but a super admin, and a member who has not consented", async () => {
    const noConsent = await makeMember("NoConsent", false);
    await expect(
      recordCalibrationSample({ id: actorId, roles: ["ATTENDANCE_OFFICER"] }, { gatheringId, memberId: noConsent, embedding: unit(703), livenessScore: 0.9 }),
    ).rejects.toBeInstanceOf(CalibrationError);
    await expect(
      recordCalibrationSample({ id: actorId, roles: ["SUPER_ADMIN"] }, { gatheringId, memberId: noConsent, embedding: unit(703), livenessScore: 0.9 }),
    ).rejects.toThrow("not consented");
  });
});
