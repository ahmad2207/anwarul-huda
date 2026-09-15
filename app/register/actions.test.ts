import { afterAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetRateLimitForTests } from "@/lib/rate-limit";
import { submitRegistration } from "./actions";

// Integration test against the real local Postgres database (see
// vitest.config.mts), since this exercises the actual transaction: the
// Member, its household rows, its service areas, and its linked but
// inactive User all have to land together correctly.

const SURNAME_PREFIX = `RegTestFixture${Date.now()}`;
// A phone number tied to this run, not just an incrementing counter, so a
// leftover row from an earlier, interrupted run can never collide with
// this run's numbers (phone is unique on User, and deleting a Member only
// nulls User.memberId rather than deleting the User, so a stray row can
// otherwise outlive the Member that created it).
const PHONE_PREFIX = `80${String(Date.now()).slice(-6)}`;
let phoneCounter = 0;

function buildFormData(overrides: Record<string, string> = {}): FormData {
  phoneCounter += 1;
  const formData = new FormData();
  const fields: Record<string, string> = {
    surname: SURNAME_PREFIX,
    firstName: "Applicant",
    gender: "FEMALE",
    phone: `+234${PHONE_PREFIX}${String(phoneCounter).padStart(2, "0")}`,
    wingId: "", // filled in per test once the wing id is known
    consentRecords: "on",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
    household: JSON.stringify([{ fullName: "Fixture Child", age: "5", relationship: "Daughter" }]),
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("submitRegistration", () => {
  // Rate limiting keys on the caller's IP, which falls back to a fixed
  // "unknown" value outside a real request (see lib/rate-limit.ts's
  // getClientIp). Reset between tests so this file's own test count
  // never runs into the limit meant for a real, abusive client.
  beforeEach(() => {
    resetRateLimitForTests();
  });

  afterAll(async () => {
    // Delete the User rows explicitly. Deleting the Member alone only
    // nulls User.memberId (it is a nullable foreign key), it does not
    // remove the User row, which would otherwise linger forever and
    // could collide with a later run on the unique phone constraint.
    await prisma.user.deleteMany({ where: { phone: { startsWith: `+234${PHONE_PREFIX}` } } });
    await prisma.member.deleteMany({ where: { surname: { startsWith: SURNAME_PREFIX } } });
    await prisma.$disconnect();
  });

  it("creates a pending member with an inactive linked user and a household row", async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } });

    const result = await submitRegistration(
      {},
      buildFormData({ wingId: wing.id, surname: `${SURNAME_PREFIX}Success` }),
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const member = await prisma.member.findFirstOrThrow({
      where: { surname: `${SURNAME_PREFIX}Success` },
      include: { user: true, household: true },
    });

    expect(member.status).toBe("PENDING");
    expect(member.source).toBe("SELF_REGISTRATION");
    expect(member.memberNumber).toBeNull();
    expect(member.wingId).toBe(wing.id);

    expect(member.user).not.toBeNull();
    expect(member.user?.isActive).toBe(false);
    expect(member.user?.passwordHash).not.toBeNull();
    const passwordMatches = await bcrypt.compare(
      "correct horse battery staple",
      member.user!.passwordHash!,
    );
    expect(passwordMatches).toBe(true);

    expect(member.household).toHaveLength(1);
    expect(member.household[0].fullName).toBe("Fixture Child");
  });

  it("rejects a registration whose passwords do not match", async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } });
    const surname = `${SURNAME_PREFIX}Mismatch`;

    const result = await submitRegistration(
      {},
      buildFormData({ wingId: wing.id, surname, confirmPassword: "a different password" }),
    );

    expect(result.success).toBeUndefined();
    expect(result.error).toBeTruthy();

    const member = await prisma.member.findFirst({ where: { surname } });
    expect(member).toBeNull();
  });

  it("rejects a registration with no consent to keep records", async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } });
    const surname = `${SURNAME_PREFIX}NoConsent`;

    const result = await submitRegistration(
      {},
      buildFormData({ wingId: wing.id, surname, consentRecords: "" }),
    );

    expect(result.success).toBeUndefined();
    expect(result.error).toBeTruthy();

    const member = await prisma.member.findFirst({ where: { surname } });
    expect(member).toBeNull();
  });
});
