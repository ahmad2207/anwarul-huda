import type { Prisma, RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canEnrolMemberFace } from "@/lib/authorization";
import { excludeFromFaceCheckIn } from "@/lib/face/exclusion";

// The enrolment worklist (MEMBER-INTERFACE.md M5): the office's list of
// members still to be set up for face check-in, worked through at
// gatherings. An office task list, never shown to members and never a
// compliance score.

const MINIMUM_ENROLMENT_AGE = 18;

interface Officer {
  id: string;
  roles: RoleName[];
  wingIds: string[];
}

export type WorklistFilter = "all" | "deferred" | "never";

export class EnrolmentWorklistError extends Error {}

/**
 * Who belongs on the list: active members (only they can be checked in)
 * with no face set up, not permanently checked in by name, and old
 * enough to enrol. Under 18s are left off entirely until the committee
 * decides on guardian consent: they cannot be enrolled, so listing them
 * would be a task nobody can do. A member with no date of birth stays on,
 * since adding it is part of the work.
 */
function worklistWhere(officer: Officer, options: { wingId?: string; filter: WorklistFilter; search?: string }, now: Date) {
  const adultCutoff = new Date(now);
  adultCutoff.setFullYear(adultCutoff.getFullYear() - MINIMUM_ENROLMENT_AGE);

  const isSuperAdmin = officer.roles.includes("SUPER_ADMIN");
  // The requested wing is honoured only inside the officer's own scope.
  const wingScope: Prisma.MemberWhereInput = options.wingId
    ? isSuperAdmin || officer.wingIds.includes(options.wingId)
      ? { wingId: options.wingId }
      : { id: { in: [] } }
    : isSuperAdmin
      ? {}
      : { wingId: { in: officer.wingIds } };

  const and: Prisma.MemberWhereInput[] = [
    wingScope,
    { OR: [{ dateOfBirth: null }, { dateOfBirth: { lte: adultCutoff } }] },
  ];
  if (options.filter === "deferred") and.push({ faceEnrolmentDeferred: true });
  if (options.filter === "never") and.push({ faceEnrolmentDeferred: false });
  if (options.search) {
    and.push({
      OR: [
        { surname: { contains: options.search, mode: "insensitive" } },
        { firstName: { contains: options.search, mode: "insensitive" } },
        { fullNameAsWritten: { contains: options.search, mode: "insensitive" } },
        { memberNumber: { contains: options.search, mode: "insensitive" } },
      ],
    });
  }

  return {
    status: "ACTIVE",
    faceCheckInExcluded: false,
    faceEnrolments: { none: { isActive: true } },
    AND: and,
  } satisfies Prisma.MemberWhereInput;
}

export async function getEnrolmentWorklist(
  officer: Officer,
  options: { wingId?: string; filter: WorklistFilter; search?: string },
  pagination: { page: number; pageSize: number },
  now: Date = new Date(),
) {
  const where = worklistWhere(officer, options, now);
  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      select: {
        id: true,
        memberNumber: true,
        title: true,
        surname: true,
        firstName: true,
        fullNameAsWritten: true,
        dateOfBirth: true,
        faceEnrolmentDeferred: true,
        faceEnrolmentDeferredAt: true,
        wing: { select: { name: true } },
        // Only whether a setup attempt is waiting on a face match review,
        // never who with.
        _count: { select: { faceMatchCasesAsA: { where: { status: "OPEN", source: "ENROLMENT" } } } },
      },
      // Members who asked for help first, then by name.
      orderBy: [{ faceEnrolmentDeferred: "desc" }, { surname: "asc" }, { firstName: "asc" }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.member.count({ where }),
  ]);

  return {
    total,
    members: members.map(({ _count, ...member }) => ({ ...member, heldForReview: _count.faceMatchCasesAsA > 0 })),
  };
}

/**
 * Records that a member will not use face check-in (M5 #4): off the
 * worklist permanently, deferral cleared, never an incomplete record,
 * checked in by name from then on. The officer must be allowed to enrol
 * this member at all, the same wing rule as setting them up.
 */
export async function recordWillNotUseFaceCheckIn(officer: Officer, memberId: string, note: string | null): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({
      where: { id: memberId },
      select: { wingId: true, faceCheckInExcluded: true },
    });
    if (!member || !canEnrolMemberFace(officer, member.wingId)) {
      throw new EnrolmentWorklistError("That member could not be found, or is not in a wing you cover.");
    }
    if (member.faceCheckInExcluded) {
      throw new EnrolmentWorklistError("This member is already checked in by name.");
    }
    await excludeFromFaceCheckIn(tx, memberId, officer.id, { kind: "declined", note: note?.trim() || null });
  });
}
