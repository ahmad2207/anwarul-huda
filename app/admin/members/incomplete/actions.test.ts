import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { completeIncompleteMember } from "./actions";

// Regression test: this admin action used to set isRecordIncomplete to
// false directly the moment surname, firstName and phone were filled in,
// even though MEMBER-INTERFACE.md's nine-section record replaced that
// three-field notion of "complete" with completedSections covering all
// nine sections (prisma/schema.prisma's own comment on isRecordIncomplete
// documents this). Filling in only the fields this form touches must
// mark NAME and CONTACT complete, the same bar the member's own record
// flow uses for those two sections, and must never clear
// isRecordIncomplete on its own, since seven sections remain untouched.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

const FIXTURE_TAG = `IncompleteFixture${Date.now()}`;

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

describe("completeIncompleteMember", () => {
  let actorId: string;
  let wingId: string;

  beforeAll(async () => {
    const actor = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    actorId = actor.id;
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: actorId } } as never);

    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    wingId = wing.id;
  });

  afterAll(async () => {
    await prisma.member.deleteMany({ where: { surname: { startsWith: FIXTURE_TAG } } });
    await prisma.$disconnect();
  });

  async function makeIncompleteMember() {
    return prisma.member.create({
      data: {
        surname: `${FIXTURE_TAG}Unknown`,
        firstName: "Unknown",
        gender: "MALE",
        status: "ACTIVE",
        source: "CSV_IMPORT",
        wingId,
        isRecordIncomplete: true,
      },
    });
  }

  it("marks NAME and CONTACT complete without clearing isRecordIncomplete", async () => {
    const member = await makeIncompleteMember();

    const result = await completeIncompleteMember(
      undefined,
      formData({
        memberId: member.id,
        surname: `${FIXTURE_TAG}Resolved`,
        firstName: "Musa",
        phone: "08011112222",
        noPhoneOnFile: "",
      }),
    );

    expect(result).toBeUndefined();

    const updated = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(updated.surname).toBe(`${FIXTURE_TAG}Resolved`);
    expect(updated.completedSections).toEqual(expect.arrayContaining(["NAME", "CONTACT"]));
    expect(updated.completedSections).toHaveLength(2);
    expect(updated.isRecordIncomplete).toBe(true);
  });

  it("records No phone on file as null, not an invented number", async () => {
    const member = await makeIncompleteMember();

    await completeIncompleteMember(
      undefined,
      formData({
        memberId: member.id,
        surname: `${FIXTURE_TAG}NoPhone`,
        firstName: "Amina",
        phone: "",
        noPhoneOnFile: "on",
      }),
    );

    const updated = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(updated.phone).toBeNull();
    expect(updated.completedSections).toEqual(expect.arrayContaining(["NAME", "CONTACT"]));
  });
});
