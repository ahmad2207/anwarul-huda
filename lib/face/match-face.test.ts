import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { toVectorLiteral } from "@/lib/face/vector-literal";
import { matchFaceForCheckIn } from "./match-face";

// Integration test against the real database: pgvector's <=> operator
// and the wing-scoping join are exactly the kind of thing worth proving
// end to end rather than trusting by inspection.

const FIXTURE_TAG = `MatchFaceFixture${Date.now()}`;
const memberIds: string[] = [];

// A one-hot vector spiking at a unique index per fixture: two fixtures
// with different spike indices are exactly orthogonal (cosine
// similarity 0), and a query built from the same spike index as an
// enrolled member is identical to it (similarity 1). Deterministic and
// distinguishable, without needing real face data.
function embeddingWithSpikeAt(index: number): number[] {
  const vector = new Array(1024).fill(0);
  vector[index] = 1;
  return vector;
}

describe("matchFaceForCheckIn", () => {
  let mensWingId: string;
  let womensWingId: string;

  beforeAll(async () => {
    const mens = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    mensWingId = mens.id;
    const womens = await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } });
    womensWingId = womens.id;
  });

  afterAll(async () => {
    await prisma.faceEnrolment.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
    await prisma.$disconnect();
  });

  async function makeEnrolledMember(
    suffix: string,
    wingId: string,
    embedding: number[],
    options: { isActive?: boolean; memberStatus?: "ACTIVE" | "INACTIVE" } = {},
  ): Promise<string> {
    const member = await prisma.member.create({
      data: {
        surname: `${FIXTURE_TAG}${suffix}`,
        firstName: "Test",
        gender: "MALE",
        status: options.memberStatus ?? "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId,
      },
    });
    memberIds.push(member.id);

    await prisma.$executeRaw`
      INSERT INTO face_enrolments (id, member_id, embedding, liveness_score, enrolled_at, is_active)
      VALUES (${`${FIXTURE_TAG}${suffix}`}, ${member.id}, ${toVectorLiteral(embedding)}::vector, 0.9, ${new Date()}, ${options.isActive ?? true})
    `;

    return member.id;
  }

  it("matches a member against their own enrolled embedding", async () => {
    const embedding = embeddingWithSpikeAt(10);
    const memberId = await makeEnrolledMember("Self", mensWingId, embedding);

    const match = await matchFaceForCheckIn(embedding, mensWingId);

    expect(match?.memberId).toBe(memberId);
    expect(match?.similarity).toBeCloseTo(1, 5);
  });

  it("returns no match for a clearly different embedding", async () => {
    await makeEnrolledMember("Enrolled", mensWingId, embeddingWithSpikeAt(20));
    const differentEmbedding = embeddingWithSpikeAt(21); // orthogonal: similarity 0

    const match = await matchFaceForCheckIn(differentEmbedding, mensWingId);

    expect(match).toBeNull();
  });

  it("does not match a member enrolled in a different wing", async () => {
    const embedding = embeddingWithSpikeAt(30);
    await makeEnrolledMember("OtherWing", mensWingId, embedding);

    // The exact same embedding, scoped to a wing this member is not in.
    const match = await matchFaceForCheckIn(embedding, womensWingId);

    expect(match).toBeNull();
  });

  it("does not match an inactive (withdrawn) enrolment", async () => {
    const embedding = embeddingWithSpikeAt(40);
    await makeEnrolledMember("Withdrawn", mensWingId, embedding, { isActive: false });

    const match = await matchFaceForCheckIn(embedding, mensWingId);

    expect(match).toBeNull();
  });

  it("does not match a member who is no longer active", async () => {
    const embedding = embeddingWithSpikeAt(50);
    await makeEnrolledMember("Inactive", mensWingId, embedding, { memberStatus: "INACTIVE" });

    const match = await matchFaceForCheckIn(embedding, mensWingId);

    expect(match).toBeNull();
  });

  it("matches across the whole organisation when the gathering has no wing", async () => {
    const embedding = embeddingWithSpikeAt(60);
    const memberId = await makeEnrolledMember("AllWings", womensWingId, embedding);

    const match = await matchFaceForCheckIn(embedding, null);

    expect(match?.memberId).toBe(memberId);
  });

  it("refuses an embedding that is not exactly 1024 numbers", async () => {
    await expect(matchFaceForCheckIn([1, 2, 3], mensWingId)).rejects.toThrow();
  });
});
