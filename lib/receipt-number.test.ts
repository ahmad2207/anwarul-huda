import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { generateReceiptNumber } from "./receipt-number";

// Integration tests against the real local Postgres database (see
// vitest.config.mts), the same reason lib/member-number.test.ts is: the
// safety property under test is that no two concurrent transactions ever
// compute the same number, which cannot be verified against a mock.

const FIXTURE_TAG = `ReceiptNumberTestFixture${Date.now()}`;

function paymentFixture(overrides: { receiptNumber: string; memberId: string; collectedById: string }) {
  return {
    narration: FIXTURE_TAG,
    amountKobo: 1000,
    method: "CASH" as const,
    paidAt: new Date(),
    ...overrides,
  };
}

describe("generateReceiptNumber", () => {
  let memberId: string;
  let collectedById: string;

  beforeAll(async () => {
    // A dedicated fixture member, not "any active member" picked up with
    // findFirst: other test files running in parallel create and delete
    // their own fixture members throughout a full test run, and grabbing
    // an arbitrary one here raced with another file's cleanup deleting
    // the very member this file was mid-transaction with.
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Fixture",
        gender: "MALE",
        phone: "+2348044440001",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });
    memberId = member.id;

    const user = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    collectedById = user.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { narration: FIXTURE_TAG } });
    await prisma.member.deleteMany({ where: { surname: FIXTURE_TAG } });
    await prisma.$disconnect();
  });

  it("issues sequential numbers starting at 000001 for a fresh year", async () => {
    const year = 9201;

    const first = await prisma.$transaction((tx) => generateReceiptNumber(tx, { year }));
    expect(first).toBe(`RCT/${year}/000001`);
    await prisma.payment.create({ data: paymentFixture({ receiptNumber: first, memberId, collectedById }) });

    const second = await prisma.$transaction((tx) => generateReceiptNumber(tx, { year }));
    expect(second).toBe(`RCT/${year}/000002`);
  });

  it("keeps different years independent", async () => {
    const numberForYearA = await prisma.$transaction((tx) => generateReceiptNumber(tx, { year: 9202 }));
    const numberForYearB = await prisma.$transaction((tx) => generateReceiptNumber(tx, { year: 9203 }));
    expect(numberForYearA).toBe("RCT/9202/000001");
    expect(numberForYearB).toBe("RCT/9203/000001");
  });

  it("never issues the same number twice when called concurrently", async () => {
    const year = 9204;
    const concurrency = 10;

    const numbers = await Promise.all(
      Array.from({ length: concurrency }, () =>
        prisma.$transaction(async (tx) => {
          const number = await generateReceiptNumber(tx, { year });
          await tx.payment.create({ data: paymentFixture({ receiptNumber: number, memberId, collectedById }) });
          return number;
        }),
      ),
    );

    expect(new Set(numbers).size).toBe(concurrency);
  });
});
