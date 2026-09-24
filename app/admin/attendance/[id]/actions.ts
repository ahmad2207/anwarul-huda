"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";
import { checkInMember } from "@/lib/attendance/check-in";
import { formatMemberName } from "@/lib/members/display-name";
import { matchFaceForCheckIn } from "@/lib/face/match-face";
import { UNCALIBRATED_MIN_LIVENESS_SCORE } from "@/lib/face/thresholds";

async function requireGatheringAccess(gatheringId: string) {
  const actor = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const gathering = await prisma.gathering.findUnique({ where: { id: gatheringId } });
  if (!gathering) {
    throw new Error("This gathering no longer exists.");
  }
  const canSeeAll = canViewAllWings(actor) || actor.roles.includes("ATTENDANCE_OFFICER");
  if (!canSeeAll && (!gathering.wingId || !actor.wingIds.includes(gathering.wingId))) {
    throw new Error("You do not have access to this gathering.");
  }
  return { actor, gathering };
}

export interface RosterMember {
  id: string;
  memberNumber: string | null;
  surname: string | null;
  firstName: string | null;
  fullNameAsWritten: string | null;
  photoPath: string | null;
  wingName: string;
  alreadyCheckedIn: boolean;
}

// Capped the same way the CSV import row limit is (lib/import/parse-csv.ts):
// a generous ceiling for a real gathering's scope, not an unbounded fetch.
const MAX_ROSTER_SIZE = 5000;

/**
 * Loads every active member in this gathering's scope once, up front, so
 * the check-in screen can search and resolve a scanned QR code entirely
 * client side afterwards, with no further server round trip needed to
 * identify who is being checked in. This is what makes the offline
 * design actually complete: without it, only the final check-in
 * submission would be resilient to a dropped connection, but finding the
 * member to check in would still require one.
 */
export async function loadCheckInRoster(gatheringId: string): Promise<RosterMember[]> {
  const { gathering } = await requireGatheringAccess(gatheringId);

  const members = await prisma.member.findMany({
    where: {
      status: "ACTIVE",
      ...(gathering.wingId ? { wingId: gathering.wingId } : {}),
    },
    include: { wing: true, attendance: { where: { gatheringId } } },
    orderBy: { surname: "asc" },
    take: MAX_ROSTER_SIZE,
  });

  return members.map((member) => ({
    id: member.id,
    memberNumber: member.memberNumber,
    surname: member.surname,
    firstName: member.firstName,
    fullNameAsWritten: member.fullNameAsWritten,
    photoPath: member.photoPath,
    wingName: member.wing.name,
    alreadyCheckedIn: member.attendance.length > 0,
  }));
}

export interface CheckInActionResult {
  error?: string;
  memberId?: string;
  memberName?: string;
  memberNumber?: string | null;
  alreadyCheckedIn?: boolean;
  checkedInAt?: string;
  recordId?: string;
}

export async function checkInAction(
  gatheringId: string,
  memberId: string,
  method: "MANUAL" | "QR_CODE",
): Promise<CheckInActionResult> {
  const { actor, gathering } = await requireGatheringAccess(gatheringId);

  if (gathering.isClosed) {
    return { error: "This gathering is closed. No further check-ins are accepted." };
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member || member.status !== "ACTIVE") {
    return { error: "This member cannot be checked in." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const outcome = await checkInMember(tx, { gatheringId, memberId, method, recordedById: actor.id });
    // Only a genuinely new check-in is audited, not a re-scan of someone
    // already checked in: that case changes nothing, so there is nothing
    // to record.
    if (!outcome.alreadyCheckedIn) {
      await writeAudit(
        {
          actorId: actor.id,
          action: "attendance.checked_in",
          entity: "AttendanceRecord",
          entityId: outcome.record.id,
          before: null,
          after: outcome.record,
        },
        tx,
      );
    }
    return outcome;
  });

  revalidatePath(`/admin/attendance/${gatheringId}`);

  return {
    memberId: member.id,
    memberName: formatMemberName(member),
    memberNumber: member.memberNumber,
    alreadyCheckedIn: result.alreadyCheckedIn,
    checkedInAt: result.record.checkedInAt.toISOString(),
    recordId: result.record.id,
  };
}

/** For the QR scan path: the scanned code is the member number, not an id. */
export async function checkInByMemberNumber(
  gatheringId: string,
  memberNumber: string,
): Promise<CheckInActionResult> {
  await requireGatheringAccess(gatheringId);

  const member = await prisma.member.findUnique({ where: { memberNumber: memberNumber.trim() } });
  if (!member) {
    return { error: `No member found with number ${memberNumber}.` };
  }

  return checkInAction(gatheringId, member.id, "QR_CODE");
}

/**
 * SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md B2 #1/#6: matches a live embedding
 * against enrolled members scoped to this gathering's wing and, if
 * confident, checks that member in exactly the way a manual or QR
 * check-in does. No match, a closed gathering the embedding was too
 * unconvincing to be worth checking, and a match whose member is no
 * longer active all return the same shape as "nothing happened" rather
 * than an error: a face check-in that does not resolve is the ordinary
 * case, not a failure, and the officer's screen falls back to manual
 * search either way, with no error state to show for it.
 */
export async function checkInByFace(
  gatheringId: string,
  embedding: number[],
  livenessScore: number,
): Promise<CheckInActionResult> {
  const { actor, gathering } = await requireGatheringAccess(gatheringId);

  if (gathering.isClosed) {
    return { error: "This gathering is closed. No further check-ins are accepted." };
  }

  if (livenessScore < UNCALIBRATED_MIN_LIVENESS_SCORE) {
    return {};
  }

  const match = await matchFaceForCheckIn(embedding, gathering.wingId);
  if (!match) {
    return {};
  }

  const member = await prisma.member.findUnique({ where: { id: match.memberId } });
  if (!member || member.status !== "ACTIVE") {
    return {};
  }

  const result = await prisma.$transaction(async (tx) => {
    const outcome = await checkInMember(tx, {
      gatheringId,
      memberId: member.id,
      method: "FACE",
      recordedById: actor.id,
      matchScore: match.similarity,
      livenessScore,
    });
    if (!outcome.alreadyCheckedIn) {
      await writeAudit(
        {
          actorId: actor.id,
          action: "attendance.checked_in",
          entity: "AttendanceRecord",
          entityId: outcome.record.id,
          before: null,
          after: outcome.record,
        },
        tx,
      );
    }
    return outcome;
  });

  revalidatePath(`/admin/attendance/${gatheringId}`);

  return {
    memberId: member.id,
    memberName: formatMemberName(member),
    memberNumber: member.memberNumber,
    alreadyCheckedIn: result.alreadyCheckedIn,
    checkedInAt: result.record.checkedInAt.toISOString(),
    recordId: result.record.id,
  };
}

export async function undoCheckIn(gatheringId: string, recordId: string): Promise<void> {
  const { actor } = await requireGatheringAccess(gatheringId);

  const record = await prisma.attendanceRecord.findUnique({ where: { id: recordId } });
  if (!record || record.gatheringId !== gatheringId) {
    throw new Error("This check-in no longer exists.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.attendanceRecord.delete({ where: { id: recordId } });
    await writeAudit(
      {
        actorId: actor.id,
        action: "attendance.check_in_undone",
        entity: "AttendanceRecord",
        entityId: recordId,
        before: record,
        after: null,
      },
      tx,
    );
  });

  revalidatePath(`/admin/attendance/${gatheringId}`);
}
