import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { withNamedLock } from "@/lib/advisory-lock";
import { toVectorLiteral } from "@/lib/face/vector-literal";
import { decideEnrolment, type EnrolledCandidate } from "@/lib/face/enrolment-decision";
import { duplicateDetectionThreshold } from "@/lib/face/thresholds";
import { getFaceThresholds } from "@/lib/face/threshold-settings";

// The one place a face embedding is written, for a member enrolling
// themselves (app/account/face/actions.ts) and for an officer enrolling a
// member at the mosque (app/admin/members/[id]/face/actions.ts) alike.
// Duplicate detection (MEMBER-HOME-AND-ADMIN-VIEW.md 3.2) runs here, so
// neither path can save without it.

/** How many of the nearest enrolled faces to compare against. Only ones at or above the detection threshold matter. */
const CANDIDATE_LIMIT = 10;

const ENROLMENT_LOCK = "face-enrolment";

export interface SaveEnrolmentInput {
  memberId: string;
  embedding: number[];
  livenessScore: number;
  deviceLabel: string | null;
  /** The user performing the enrolment: the member themselves, or the officer assisting them. */
  actorId: string;
  /** True when an officer enrolled the member in person. Recorded in the audit entry. */
  officerAssisted: boolean;
}

export type SaveEnrolmentResult =
  | { kind: "saved"; isReEnrolment: boolean }
  /** Too close to another member's face. Nothing was saved and a review case exists. Never says who. */
  | { kind: "held_for_review" }
  /** This member is permanently checked in by name after a review. */
  | { kind: "excluded" };

interface CandidateRow {
  memberId: string;
  similarity: number;
}

export async function saveEnrolmentForMember(input: SaveEnrolmentInput): Promise<SaveEnrolmentResult> {
  const vector = toVectorLiteral(input.embedding);
  // Derived from the check-in threshold in force, so recalibrating check-in
  // moves duplicate detection with it.
  const threshold = duplicateDetectionThreshold((await getFaceThresholds()).matchThreshold);

  return prisma.$transaction(async (tx) => {
    // Detection and the save happen under one lock, so two members
    // enrolling the same face at the same moment are compared against
    // each other rather than both passing a check the other has not
    // written yet.
    await withNamedLock(tx, ENROLMENT_LOCK);

    const member = await tx.member.findUniqueOrThrow({
      where: { id: input.memberId },
      select: { faceCheckInExcluded: true, faceEnrolmentDeferred: true },
    });
    if (member.faceCheckInExcluded) {
      return { kind: "excluded" } as const;
    }

    // Every wing, not just the member's own: check-in at a gathering open
    // to all wings compares everyone, so a pair in different wings can
    // still be confused.
    const candidates = await tx.$queryRaw<CandidateRow[]>`
      SELECT member_id AS "memberId", 1 - (embedding <=> ${vector}::vector) AS similarity
      FROM face_enrolments
      WHERE is_active = true
      ORDER BY embedding <=> ${vector}::vector ASC
      LIMIT ${CANDIDATE_LIMIT}
    `;

    const dismissed = await tx.faceMatchCase.findMany({
      where: {
        status: "DISMISSED",
        OR: [{ memberAId: input.memberId }, { memberBId: input.memberId }],
      },
      select: { memberAId: true, memberBId: true },
    });
    const dismissedIds = new Set(
      dismissed.map((pair) => (pair.memberAId === input.memberId ? pair.memberBId : pair.memberAId)),
    );

    const decision = decideEnrolment(input.memberId, candidates as EnrolledCandidate[], dismissedIds, threshold);

    if (decision.kind === "conflict") {
      for (const match of decision.matches) {
        // One open case per pair: trying again while a case is waiting
        // does not pile up duplicates for the reviewer.
        const existing = await tx.faceMatchCase.findFirst({
          where: {
            status: "OPEN",
            OR: [
              { memberAId: input.memberId, memberBId: match.memberId },
              { memberAId: match.memberId, memberBId: input.memberId },
            ],
          },
          select: { id: true },
        });
        if (existing) continue;

        const created = await tx.faceMatchCase.create({
          data: {
            memberAId: input.memberId,
            memberBId: match.memberId,
            similarity: match.similarity,
            thresholdUsed: threshold,
            source: "ENROLMENT",
          },
        });
        await writeAudit(
          {
            actorId: input.actorId,
            action: "face_match_case.opened",
            entity: "FaceMatchCase",
            entityId: created.id,
            before: null,
            after: { source: "ENROLMENT", similarity: match.similarity, thresholdUsed: threshold },
          },
          tx,
        );
      }

      // The member is told only that the office will help, and goes on
      // the office's enrolment list the same way a deferral does, so the
      // record can still complete.
      if (!member.faceEnrolmentDeferred) {
        await tx.member.update({
          where: { id: input.memberId },
          data: { faceEnrolmentDeferred: true, faceEnrolmentDeferredAt: new Date() },
        });
      }
      await writeAudit(
        {
          actorId: input.actorId,
          action: "member.face_enrolment_held_for_review",
          entity: "Member",
          entityId: input.memberId,
          before: null,
          after: { officerAssisted: input.officerAssisted, casesRaised: decision.matches.length },
        },
        tx,
      );
      return { kind: "held_for_review" } as const;
    }

    const isReEnrolment = (await tx.faceEnrolment.count({ where: { memberId: input.memberId } })) > 0;

    // Replaces, never accumulates: every previous embedding for this
    // member is gone before the new one is written, in the same
    // transaction as the insert.
    await tx.faceEnrolment.deleteMany({ where: { memberId: input.memberId } });
    await tx.$executeRaw`
      INSERT INTO face_enrolments (id, member_id, embedding, liveness_score, enrolled_at, device_label, is_active)
      VALUES (${crypto.randomUUID()}, ${input.memberId}, ${vector}::vector, ${input.livenessScore}, ${new Date()}, ${input.deviceLabel}, true)
    `;

    // A real enrolment supersedes an earlier deferral, which also takes
    // the member off the office's enrolment list.
    if (member.faceEnrolmentDeferred) {
      await tx.member.update({
        where: { id: input.memberId },
        data: { faceEnrolmentDeferred: false, faceEnrolmentDeferredAt: null },
      });
    }

    // Never the embedding itself, only that an enrolment happened, how,
    // and with what liveness score.
    await writeAudit(
      {
        actorId: input.actorId,
        action: isReEnrolment ? "member.face_re_enrolled" : "member.face_enrolled",
        entity: "Member",
        entityId: input.memberId,
        before: null,
        after: {
          livenessScore: input.livenessScore,
          deviceLabel: input.deviceLabel,
          officerAssisted: input.officerAssisted,
        },
      },
      tx,
    );

    return { kind: "saved", isReEnrolment } as const;
  });
}
