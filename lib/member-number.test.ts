import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { generateMemberNumber, MemberNumberError, normalizeMemberNumberInput } from "./member-number";

// These are integration tests against the real local Postgres database
// (see vitest.config.mts). The safety property under test, no two
// concurrent transactions ever computing the same number, cannot be
// verified against a mock.

const FIXTURE_SURNAME = "MemberNumberTestFixture";

function memberFixture(overrides: { wingId: string; memberNumber: string; phone: string }) {
  return {
    surname: FIXTURE_SURNAME,
    firstName: "Fixture",
    gender: "MALE" as const,
    status: "ACTIVE" as const,
    source: "ADMIN_ENTRY" as const,
    ...overrides,
  };
}

let phoneCounter = 0;
function nextFixturePhone(): string {
  phoneCounter += 1;
  return `+2348090${String(phoneCounter).padStart(6, "0")}`;
}

describe("generateMemberNumber", () => {
  let wingId: string;

  beforeAll(async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    wingId = wing.id;
  });

  afterAll(async () => {
    await prisma.member.deleteMany({ where: { surname: FIXTURE_SURNAME } });
    await prisma.$disconnect();
  });

  it("rejects a wing number letter that is not a single uppercase letter", async () => {
    await expect(
      prisma.$transaction((tx) =>
        generateMemberNumber(tx, { wingId, wingNumberLetter: "Mx", year: 9101 }),
      ),
    ).rejects.toBeInstanceOf(MemberNumberError);
  });

  it("issues sequential numbers starting at 0001 for a fresh wing and year", async () => {
    const year = 9102;

    const first = await prisma.$transaction((tx) =>
      generateMemberNumber(tx, { wingId, wingNumberLetter: "M", year }),
    );
    expect(first).toBe(`AHL/M/${year}/0001`);

    await prisma.member.create({
      data: memberFixture({ wingId, memberNumber: first, phone: nextFixturePhone() }),
    });

    const second = await prisma.$transaction((tx) =>
      generateMemberNumber(tx, { wingId, wingNumberLetter: "M", year }),
    );
    expect(second).toBe(`AHL/M/${year}/0002`);
  });

  it("keeps different years for the same wing independent", async () => {
    const numberForYearA = await prisma.$transaction((tx) =>
      generateMemberNumber(tx, { wingId, wingNumberLetter: "M", year: 9103 }),
    );
    const numberForYearB = await prisma.$transaction((tx) =>
      generateMemberNumber(tx, { wingId, wingNumberLetter: "M", year: 9104 }),
    );
    expect(numberForYearA).toBe("AHL/M/9103/0001");
    expect(numberForYearB).toBe("AHL/M/9104/0001");
  });

  it("never issues the same number twice when called concurrently", async () => {
    const year = 9105;
    const concurrency = 10;

    const numbers = await Promise.all(
      Array.from({ length: concurrency }, () =>
        prisma.$transaction(async (tx) => {
          const number = await generateMemberNumber(tx, { wingId, wingNumberLetter: "M", year });
          await tx.member.create({
            data: memberFixture({ wingId, memberNumber: number, phone: nextFixturePhone() }),
          });
          return number;
        }),
      ),
    );

    expect(new Set(numbers).size).toBe(concurrency);
  });
});

describe("normalizeMemberNumberInput", () => {
  it("accepts the canonical form unchanged", () => {
    expect(normalizeMemberNumberInput("AHL/M/2026/0113")).toBe("AHL/M/2026/0113");
  });

  it("accepts spaces in place of slashes, in any case", () => {
    expect(normalizeMemberNumberInput("ahl m 2026 0113")).toBe("AHL/M/2026/0113");
  });

  it("accepts the number with every separator removed", () => {
    expect(normalizeMemberNumberInput("AHLM20260113")).toBe("AHL/M/2026/0113");
  });

  it("accepts dashes as separators", () => {
    expect(normalizeMemberNumberInput("AHL-M-2026-0113")).toBe("AHL/M/2026/0113");
  });

  it("accepts a mix of separators and surrounding whitespace", () => {
    expect(normalizeMemberNumberInput("  ahl/m 2026-0113  ")).toBe("AHL/M/2026/0113");
  });

  it("works for a wing letter other than M", () => {
    expect(normalizeMemberNumberInput("AHL/W/2025/0042")).toBe("AHL/W/2025/0042");
    expect(normalizeMemberNumberInput("ahly20260007")).toBe("AHL/Y/2026/0007");
  });

  it("returns null for a string that is not a member number", () => {
    expect(normalizeMemberNumberInput("not a member number")).toBeNull();
    expect(normalizeMemberNumberInput("someone@example.com")).toBeNull();
    expect(normalizeMemberNumberInput("08012345678")).toBeNull();
  });

  it("returns null for a wing letter run that is not exactly one letter", () => {
    expect(normalizeMemberNumberInput("AHL/MW/2026/0113")).toBeNull();
  });

  it("returns null for a sequence or year of the wrong length", () => {
    expect(normalizeMemberNumberInput("AHL/M/26/0113")).toBeNull();
    expect(normalizeMemberNumberInput("AHL/M/2026/113")).toBeNull();
  });
});
