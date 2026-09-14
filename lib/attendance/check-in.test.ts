import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkInMember } from "./check-in";

// Integration tests against the real local Postgres database, matching
// Phase 5's own duplicate-handling requirement and accept criterion.

const FIXTURE_TAG = `CheckInFixture${Date.now()}`;

describe("checkInMember", () => {
  let gatheringId: string;
  let memberId: string;
  let actorId: string;

  beforeAll(async () => {
    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    const actor = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    actorId = actor.id;

    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Attendee",
        gender: "MALE",
        phone: "+2348077770001",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });
    memberId = member.id;

    const gathering = await prisma.gathering.create({
      data: { title: `${FIXTURE_TAG} gathering`, type: "JUMUAH", startsAt: new Date() },
    });
    gatheringId = gathering.id;
  });

  afterAll(async () => {
    await prisma.attendanceRecord.deleteMany({ where: { gatheringId } });
    await prisma.gathering.delete({ where: { id: gatheringId } });
    await prisma.member.deleteMany({ where: { surname: FIXTURE_TAG } });
    await prisma.$disconnect();
  });

  it("creates a new record on the first check-in", async () => {
    const result = await prisma.$transaction((tx) =>
      checkInMember(tx, { gatheringId, memberId, method: "MANUAL", recordedById: actorId }),
    );
    expect(result.alreadyCheckedIn).toBe(false);
    expect(result.record.memberId).toBe(memberId);
  });

  it("silently returns the existing record on a duplicate check-in, rather than an error", async () => {
    const result = await prisma.$transaction((tx) =>
      checkInMember(tx, { gatheringId, memberId, method: "QR_CODE", recordedById: actorId }),
    );
    expect(result.alreadyCheckedIn).toBe(true);
    // The method on the stored record is still MANUAL, from the first
    // check-in: a duplicate check-in never overwrites the original.
    expect(result.record.method).toBe("MANUAL");

    const count = await prisma.attendanceRecord.count({ where: { gatheringId, memberId } });
    expect(count).toBe(1);
  });

  it("never creates two rows even when two check-ins for the same member race each other", async () => {
    const otherWing = await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } });
    const raceMember = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "RaceAttendee",
        gender: "FEMALE",
        phone: "+2348077770002",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: otherWing.id,
      },
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        prisma.$transaction((tx) =>
          checkInMember(tx, {
            gatheringId,
            memberId: raceMember.id,
            method: "MANUAL",
            recordedById: actorId,
          }),
        ),
      ),
    );

    const newlyCreated = results.filter((r) => !r.alreadyCheckedIn);
    expect(newlyCreated).toHaveLength(1);

    const count = await prisma.attendanceRecord.count({
      where: { gatheringId, memberId: raceMember.id },
    });
    expect(count).toBe(1);
  });
});
