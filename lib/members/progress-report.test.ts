import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getMemberProgressReport } from "./progress-report";

// Integration test against the real database: the categorisation depends
// on a join between Member and its linked User, which is worth checking
// end to end rather than trusting by inspection.

const FIXTURE_TAG = `ProgressReportFixture${Date.now()}`;

describe("getMemberProgressReport", () => {
  let wingId: string;
  const memberIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    wingId = wing.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
    await prisma.$disconnect();
  });

  async function makeMember(suffix: string, completedSections: string[] = []) {
    const member = await prisma.member.create({
      data: {
        surname: `${FIXTURE_TAG}${suffix}`,
        firstName: "Test",
        gender: "MALE",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId,
        completedSections: completedSections as never,
        isRecordIncomplete: completedSections.length < 9,
      },
    });
    memberIds.push(member.id);
    return member;
  }

  it("puts a member with no linked user in NEVER_LOGGED_IN, even with sections already completed", async () => {
    const member = await makeMember("NoUser", ["NAME", "CONTACT"]);

    const rows = await getMemberProgressReport([wingId]);
    const row = rows.find((r) => r.memberId === member.id);

    expect(row?.status).toBe("NEVER_LOGGED_IN");
  });

  it("puts a member whose linked user has never logged in in NEVER_LOGGED_IN, ahead of any admin-entered progress", async () => {
    const member = await makeMember("UnusedLogin", ["NAME", "CONTACT"]);
    const user = await prisma.user.create({
      data: { phone: `+234805551${memberIds.length}`, memberId: member.id, lastLoginAt: null },
    });
    userIds.push(user.id);

    const rows = await getMemberProgressReport([wingId]);
    const row = rows.find((r) => r.memberId === member.id);

    expect(row?.status).toBe("NEVER_LOGGED_IN");
  });

  it("puts a logged-in member with no completed sections in NOT_STARTED", async () => {
    const member = await makeMember("NotStarted");
    const user = await prisma.user.create({
      data: { phone: `+234805552${memberIds.length}`, memberId: member.id, lastLoginAt: new Date() },
    });
    userIds.push(user.id);

    const rows = await getMemberProgressReport([wingId]);
    const row = rows.find((r) => r.memberId === member.id);

    expect(row?.status).toBe("NOT_STARTED");
    expect(row?.nextSectionLabel).toBe("Your name");
  });

  it("puts a logged-in member with some sections done in PARTWAY, naming the next section", async () => {
    const member = await makeMember("Partway", ["NAME", "ABOUT"]);
    const user = await prisma.user.create({
      data: { phone: `+234805553${memberIds.length}`, memberId: member.id, lastLoginAt: new Date() },
    });
    userIds.push(user.id);

    const rows = await getMemberProgressReport([wingId]);
    const row = rows.find((r) => r.memberId === member.id);

    expect(row?.status).toBe("PARTWAY");
    expect(row?.completedCount).toBe(2);
    expect(row?.nextSectionLabel).toBe("Contact details");
  });

  it("puts a member with every section done in FINISHED", async () => {
    const allSections = ["NAME", "ABOUT", "CONTACT", "HOUSEHOLD", "MEMBERSHIP", "SERVICE", "NEXT_OF_KIN", "CONSENT", "FACE"];
    const member = await makeMember("Finished", allSections);
    const user = await prisma.user.create({
      data: { phone: `+234805554${memberIds.length}`, memberId: member.id, lastLoginAt: new Date() },
    });
    userIds.push(user.id);

    const rows = await getMemberProgressReport([wingId]);
    const row = rows.find((r) => r.memberId === member.id);

    expect(row?.status).toBe("FINISHED");
    expect(row?.nextSectionLabel).toBeNull();
  });
});
