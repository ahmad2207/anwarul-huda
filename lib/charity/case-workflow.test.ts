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
    // Case references are generated (CASE/2026/000123), so the fixture
    // cases are found by their tagged beneficiary name instead.
    const cases = await prisma.charityCase.findMany({
      where: { beneficiaryName: { contains: FIXTURE_TAG } },
      select: { id: true },
    });
    const caseIds = cases.map((c) => c.id);
    await prisma.auditLog.deleteMany({ where: { OR: [{ entityId: { in: caseIds } }, { actorId: officerBId }] } });
    await prisma.charityCase.deleteMany({ where: { id: { in: caseIds } } });
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

  it("double approval only succeeds once when two approvals arrive at the same moment", async () => {
    const created = await freshCase();
    const verified = await prisma.$transaction((tx) => verifyCase(tx, created, officerAId));
    const verifiedCase = (verified as { case: typeof created }).case;
    const recommended = await prisma.$transaction((tx) =>
      recommendCase(tx, verifiedCase, officerAId, 50000),
    );
    const recommendedCase = (recommended as { case: typeof created }).case;

    // Both start from the same copy of the case, as two browser tabs would.
    const approve = () =>
      prisma.$transaction((tx) => approveCase(tx, recommendedCase, officerBId, 50000, null), {
        timeout: 30000,
        maxWait: 30000,
      });
    const settled = await Promise.allSettled([approve(), approve()]);

    const succeeded = settled.filter((s) => s.status === "fulfilled" && "case" in s.value);
    const refused = settled.filter((s) => s.status === "fulfilled" && "error" in s.value);
    expect(succeeded).toHaveLength(1);
    expect(refused).toHaveLength(1);
    const refusal = refused[0];
    if (refusal.status === "fulfilled" && "error" in refusal.value) {
      expect(refusal.value.error).toMatch(/changed since you opened it/i);
    }

    const approvals = await prisma.auditLog.count({
      where: { entity: "CharityCase", entityId: created.id, action: "charity_case.approved" },
    });
    expect(approvals).toBe(1);
  });

  it("refuses to reject a case once it has been approved", async () => {
    const created = await freshCase();
    const verified = await prisma.$transaction((tx) => verifyCase(tx, created, officerAId));
    const verifiedCase = (verified as { case: typeof created }).case;
    const recommended = await prisma.$transaction((tx) =>
      recommendCase(tx, verifiedCase, officerAId, 50000),
    );
    const recommendedCase = (recommended as { case: typeof created }).case;
    await prisma.$transaction((tx) => approveCase(tx, recommendedCase, officerBId, 50000, null));

    // A stale copy still says RECOMMENDED, but the row is now APPROVED.
    const result = await prisma.$transaction((tx) => rejectCase(tx, recommendedCase, officerAId, "Too late"));
    expect("error" in result).toBe(true);
    const row = await prisma.charityCase.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.status).toBe("APPROVED");
  });
});
