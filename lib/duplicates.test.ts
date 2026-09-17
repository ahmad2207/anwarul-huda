import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { findPotentialDuplicates, nameSimilarity } from "./duplicates";

describe("nameSimilarity", () => {
  it("scores identical names, once normalised, as 1", () => {
    expect(nameSimilarity("Amina Bello", "  amina   bello ")).toBe(1);
  });

  it("scores a close misspelling highly", () => {
    expect(nameSimilarity("Abubakar Sadiq", "Abubaker Sadiq")).toBeGreaterThan(0.85);
  });

  it("scores unrelated names low", () => {
    expect(nameSimilarity("Amina Bello", "Chidi Okafor")).toBeLessThan(0.4);
  });
});

// Integration tests against the real local Postgres database (see
// vitest.config.mts), since the fuzzy search itself queries the database.

describe("findPotentialDuplicates", () => {
  const uniqueSurname = `Duptest${Date.now()}`;
  let wingId: string;

  beforeAll(async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } });
    wingId = wing.id;

    await prisma.member.create({
      data: {
        surname: uniqueSurname,
        firstName: "Original",
        gender: "FEMALE",
        phone: "+2348011122233",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId,
      },
    });
  });

  afterAll(async () => {
    await prisma.member.deleteMany({ where: { surname: uniqueSurname } });
    await prisma.$disconnect();
  });

  it("matches on exact phone even with a completely different name", async () => {
    const matches = await findPotentialDuplicates(prisma, {
      phone: "+2348011122233",
      surname: "Completely Different",
      firstName: "Name",
    });

    const match = matches.find((m) => m.member.surname === uniqueSurname);
    expect(match?.matchedOnPhone).toBe(true);
  });

  it("matches on a fuzzy name with a different phone", async () => {
    const matches = await findPotentialDuplicates(prisma, {
      phone: "+2348099988877",
      surname: uniqueSurname,
      firstName: "Origina", // misspelled
    });

    const match = matches.find((m) => m.member.surname === uniqueSurname);
    expect(match?.matchedOnName).toBe(true);
  });

  it("does not match an unrelated name and phone", async () => {
    const matches = await findPotentialDuplicates(prisma, {
      phone: "+2348055566677",
      surname: "Zzznomatch",
      firstName: "Nobody",
    });

    expect(matches.find((m) => m.member.surname === uniqueSurname)).toBeUndefined();
  });

  it("excludes the candidate's own id from its results", async () => {
    const self = await prisma.member.findFirstOrThrow({ where: { surname: uniqueSurname } });

    const matches = await findPotentialDuplicates(prisma, {
      id: self.id,
      // Non-null: this test's own fixture always sets phone, surname and
      // firstName, the type is only nullable for a nominal roll member.
      phone: self.phone!,
      surname: self.surname,
      firstName: self.firstName,
    });

    expect(matches.some((m) => m.member.id === self.id)).toBe(false);
  });
});
