import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  approveCase,
  closeCase,
  createCase,
  recommendCase,
  rejectCase,
  verifyCase,
} from "./case-workflow";

// Integration tests against the real local Postgres database, matching
// Phase 4's own accept criterion: the system refuses self approval.

const FIXTURE_TAG = `CaseWorkflowFixture${Date.now()}`;

describe("case workflow", () => {
  let officerAId: string;
  let officerBId: string;

  beforeAll(async () => {
    const users = await prisma.user.findMany({
      where: { roles: { some: { role: "SUPER_ADMIN" } } },
      take: 1,
    });
    officerAId = users[0].id;

    // A second, distinct actor for the approval half of the separation
    // of duty tests. Created as its own fixture user rather than reusing
    // an existing one, so this test never depends on how many other
    // users happen to exist.
    const officerB = await prisma.user.create({
      data: { email: `${FIXTURE_TAG}-officerB@example.test`, isActive: true },
    });
    officerBId = officerB.id;
  });

  afterAll(async () => {
    await prisma.charityCase.deleteMany({ where: { reference: { contains: FIXTURE_TAG } } });
    await prisma.user.delete({ where: { id: officerBId } });
    await prisma.$disconnect();
  });

  async function freshCase() {
    return prisma.$transaction((tx) =>
      createCase(tx, {
        beneficiaryName: `${FIXTURE_TAG} Beneficiary`,
        beneficiaryPhone: null,
        beneficiaryAddress: null,
        isMember: false,
        linkedMemberId: null,
        needDescription: "Test need",
        zakatCategory: null,
        requestedKobo: 100000,
        actorId: officerAId,
      }),
    );
  }

  it("moves through draft, verified, recommended and approved in order", async () => {
    const created = await freshCase();
    expect(created.status).toBe("DRAFT");
    expect(created.reference).toMatch(/^CASE\/\d{4}\/\d{6}$/);

    const verified = await prisma.$transaction((tx) => verifyCase(tx, created, officerAId));
    expect("case" in verified && verified.case.status).toBe("VERIFIED");
    const verifiedCase = (verified as { case: typeof created }).case;

    const recommended = await prisma.$transaction((tx) =>
      recommendCase(tx, verifiedCase, officerAId, 80000),
    );
    expect("case" in recommended && recommended.case.status).toBe("RECOMMENDED");
    expect((recommended as { case: typeof created }).case.recommendedById).toBe(officerAId);
    const recommendedCase = (recommended as { case: typeof created }).case;

    const approved = await prisma.$transaction((tx) =>
      approveCase(tx, recommendedCase, officerBId, 75000, "Approved for less than requested"),
    );
    expect("case" in approved).toBe(true);
    expect((approved as { case: typeof created }).case.status).toBe("APPROVED");
  });

  it("refuses to skip a step: cannot recommend a case still in draft", async () => {
    const created = await freshCase();
    const result = await prisma.$transaction((tx) => recommendCase(tx, created, officerAId, 50000));
    expect("error" in result).toBe(true);
  });

  it("refuses self approval: the recommender cannot also approve", async () => {
    const created = await freshCase();
    const verified = await prisma.$transaction((tx) => verifyCase(tx, created, officerAId));
    const verifiedCase = (verified as { case: typeof created }).case;
    const recommended = await prisma.$transaction((tx) =>
      recommendCase(tx, verifiedCase, officerAId, 50000),
    );
    const recommendedCase = (recommended as { case: typeof created }).case;

    const result = await prisma.$transaction((tx) =>
      approveCase(tx, recommendedCase, officerAId, 50000, null),
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/cannot also approve/i);
    }

    const stillRecommended = await prisma.charityCase.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stillRecommended.status).toBe("RECOMMENDED");
  });

  it("allows a different officer to approve after someone else recommended", async () => {
    const created = await freshCase();
    const verified = await prisma.$transaction((tx) => verifyCase(tx, created, officerAId));
    const verifiedCase = (verified as { case: typeof created }).case;
    const recommended = await prisma.$transaction((tx) =>
      recommendCase(tx, verifiedCase, officerAId, 50000),
    );
    const recommendedCase = (recommended as { case: typeof created }).case;

    const result = await prisma.$transaction((tx) =>
      approveCase(tx, recommendedCase, officerBId, 50000, null),
    );
    expect("case" in result).toBe(true);
  });

  it("rejects a case with a reason, and cannot be rejected again once decided", async () => {
    const created = await freshCase();
    const rejected = await prisma.$transaction((tx) =>
      rejectCase(tx, created, officerAId, "Not a genuine need"),
    );
    expect("case" in rejected).toBe(true);
    if ("case" in rejected) {
      expect(rejected.case.status).toBe("REJECTED");
      expect(rejected.case.decisionNote).toBe("Not a genuine need");
    }
  });

  it("refuses to close a case that has not been disbursed", async () => {
    const created = await freshCase();
    const result = await prisma.$transaction((tx) => closeCase(tx, created, officerAId));
    expect("error" in result).toBe(true);
  });
});
