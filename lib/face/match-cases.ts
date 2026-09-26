import type { FaceMatchCaseStatus, Prisma, RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { withNamedLock } from "@/lib/advisory-lock";
import { canReviewFaceMatch } from "@/lib/authorization";
import { excludeFromFaceCheckIn } from "@/lib/face/exclusion";
import { duplicateDetectionThreshold } from "@/lib/face/thresholds";

// The face match review queue (MEMBER-HOME-AND-ADMIN-VIEW.md 3.5). Every
// read and every decision checks canReviewFaceMatch here, per case, so a
// page cannot show or decide a case its viewer may not see. No images and
// no embeddings are ever read by anything in this file.

export class FaceMatchReviewError extends Error {}

interface Reviewer {
  id: string;
  roles: RoleName[];
  wingIds: string[];
}

/** Restricts a case query to pairs the reviewer may see: every pair for a super admin, pairs wholly within their wings otherwise. */
function reviewerScope(reviewer: Reviewer): Prisma.FaceMatchCaseWhereInput {
  if (reviewer.roles.includes("SUPER_ADMIN")) return {};
  if (!reviewer.roles.includes("ATTENDANCE_OFFICER")) return { id: { in: [] } };
  return {
    memberA: { wingId: { in: reviewer.wingIds } },
    memberB: { wingId: { in: reviewer.wingIds } },
  };
}

const CASE_MEMBER_SELECT = {
  id: true,
  memberNumber: true,
  title: true,
  surname: true,
  firstName: true,
  fullNameAsWritten: true,
  wingId: true,
  wing: { select: { name: true } },
} as const;

export async function listFaceMatchCases(
  reviewer: Reviewer,
  filter: { status: FaceMatchCaseStatus },
  pagination: { page: number; pageSize: number },
) {
  const where: Prisma.FaceMatchCaseWhereInput = { ...reviewerScope(reviewer), status: filter.status };
  const [cases, total] = await Promise.all([
    prisma.faceMatchCase.findMany({
      where,
      select: {
        id: true,
        similarity: true,
        thresholdUsed: true,
        source: true,
        status: true,
        decisionNote: true,
        decidedAt: true,
        createdAt: true,
        decidedBy: { select: { email: true, phone: true } },
        memberA: { select: CASE_MEMBER_SELECT },
        memberB: { select: CASE_MEMBER_SELECT },
      },
      orderBy: filter.status === "OPEN" ? { createdAt: "asc" } : { decidedAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.faceMatchCase.count({ where }),
  ]);
  return { cases, total };
}

export type FaceMatchOutcome = Exclude<FaceMatchCaseStatus, "OPEN">;

/**
 * Records a reviewer's decision on an open case, with the reason, in one
 * transaction with its audit entry.
 *
 * - DISMISSED: not a real match. The pair never blocks an enrolment again,
 *   so the member can simply set up face check-in once more.
 * - INDISTINGUISHABLE: two different people check-in cannot tell apart.
 *   Both are excluded from face check-in for good: any saved face is
 *   deleted, section 9 counts as done, and neither is prompted again.
 * - SAME_PERSON: one person with two records. Only the decision is
 *   recorded here. Deactivating the duplicate record goes through the
 *   member's own status change, which also deletes its face enrolment,
 *   and a full merge is not built.
 */
export async function resolveFaceMatchCase(
  reviewer: Reviewer,
  caseId: string,
  outcome: FaceMatchOutcome,
  note: string,
): Promise<void> {
  const trimmedNote = note.trim();
  if (!trimmedNote) {
    throw new FaceMatchReviewError("Give a reason for the decision.");
  }

  await prisma.$transaction(async (tx) => {
    const found = await tx.faceMatchCase.findUnique({
      where: { id: caseId },
      include: { memberA: { select: { wingId: true } }, memberB: { select: { wingId: true } } },
    });
    // Not found and not allowed read the same, so a reviewer cannot probe
    // for cases outside their wings.
    if (!found || !canReviewFaceMatch(reviewer, found.memberA.wingId, found.memberB.wingId)) {
      throw new FaceMatchReviewError("That case could not be found.");
    }
    if (found.status !== "OPEN") {
      throw new FaceMatchReviewError("That case has already been decided.");
    }

    const decidedAt = new Date();
    await tx.faceMatchCase.update({
      where: { id: caseId },
      data: { status: outcome, decisionNote: trimmedNote, decidedById: reviewer.id, decidedAt },
    });
    await writeAudit(
      {
        actorId: reviewer.id,
        action: "face_match_case.decided",
        entity: "FaceMatchCase",
        entityId: caseId,
        before: { status: "OPEN" },
        after: { status: outcome, decisionNote: trimmedNote },
      },
      tx,
    );

    if (outcome === "INDISTINGUISHABLE") {
      for (const memberId of [found.memberAId, found.memberBId]) {
        await excludeFromFaceCheckIn(tx, memberId, reviewer.id, { kind: "review", faceMatchCaseId: caseId }, decidedAt);
      }
    }
  });
}

/** How many nearest neighbours each enrolment is compared with during a scan. Only pairs at or above the threshold become cases. */
const SCAN_NEIGHBOURS = 10;

interface ScanPairRow {
  memberAId: string;
  memberBId: string;
  similarity: number;
}

/**
 * Re-runs duplicate detection across every enrolled pair
 * (MEMBER-HOME-AND-ADMIN-VIEW.md 3.6), super admin only. A pair that
 * already has a case, open or decided, is left alone: an open one is
 * already waiting, and a decided one has been ruled on. Uses the
 * embedding index to compare each face with its nearest neighbours rather
 * than every face with every other, so it stays quick with thousands of
 * enrolments.
 */
export async function runRetrospectiveScan(reviewer: Reviewer): Promise<{ pairsFound: number; casesOpened: number }> {
  if (!reviewer.roles.includes("SUPER_ADMIN")) {
    throw new FaceMatchReviewError("Only a super administrator can run a scan.");
  }
  const threshold = duplicateDetectionThreshold();

  return prisma.$transaction(
    async (tx) => {
      // The same lock enrolment takes, so a scan and an enrolment never
      // both decide about the same new face at once.
      await withNamedLock(tx, "face-enrolment");

      const pairs = await tx.$queryRaw<ScanPairRow[]>`
        SELECT DISTINCT
          LEAST(a.member_id, n.member_id) AS "memberAId",
          GREATEST(a.member_id, n.member_id) AS "memberBId",
          n.similarity
        FROM face_enrolments a
        CROSS JOIN LATERAL (
          SELECT b.member_id, 1 - (b.embedding <=> a.embedding) AS similarity
          FROM face_enrolments b
          WHERE b.is_active = true AND b.member_id <> a.member_id
          ORDER BY b.embedding <=> a.embedding ASC
          LIMIT ${SCAN_NEIGHBOURS}
        ) n
        WHERE a.is_active = true AND n.similarity >= ${threshold}
      `;

      let casesOpened = 0;
      for (const pair of pairs) {
        const existing = await tx.faceMatchCase.findFirst({
          where: {
            OR: [
              { memberAId: pair.memberAId, memberBId: pair.memberBId },
              { memberAId: pair.memberBId, memberBId: pair.memberAId },
            ],
          },
          select: { id: true },
        });
        if (existing) continue;

        const created = await tx.faceMatchCase.create({
          data: {
            memberAId: pair.memberAId,
            memberBId: pair.memberBId,
            similarity: pair.similarity,
            thresholdUsed: threshold,
            source: "RETROSPECTIVE_SCAN",
          },
        });
        await writeAudit(
          {
            actorId: reviewer.id,
            action: "face_match_case.opened",
            entity: "FaceMatchCase",
            entityId: created.id,
            before: null,
            after: { source: "RETROSPECTIVE_SCAN", similarity: pair.similarity, thresholdUsed: threshold },
          },
          tx,
        );
        casesOpened += 1;
      }

      return { pairsFound: pairs.length, casesOpened };
    },
    // A scan can open many cases in one go, each with its own audit entry.
    { timeout: 120_000 },
  );
}
