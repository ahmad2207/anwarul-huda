import type { MemberStatus, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";

const DEACTIVATING_STATUSES: readonly MemberStatus[] = ["INACTIVE", "DECEASED"];

/**
 * SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md 4.5: "Embeddings are deleted when
 * a member becomes inactive or deceased... write the retention rule
 * into the code, not into a document." One function, called from every
 * place a member's status can change to INACTIVE or DECEASED, rather
 * than a rule left for each call site to remember on its own.
 *
 * Today there are two such places: lib/members/status-change.ts (the
 * administrator's own status change form) and
 * lib/import/rollback-import.ts (bulk deactivation when an import batch
 * is rolled back). CSV import itself never sets either status, checked
 * by hand: neither the create path nor its duplicate-row update path
 * (lib/import/commit-import.ts) touches status at all.
 */
export async function deleteFaceEnrolmentsOnDeactivation(
  tx: Prisma.TransactionClient,
  memberId: string,
  newStatus: MemberStatus,
  actorId: string | null,
): Promise<void> {
  if (!DEACTIVATING_STATUSES.includes(newStatus)) {
    return;
  }

  const count = await tx.faceEnrolment.count({ where: { memberId } });
  if (count === 0) {
    return;
  }

  await tx.faceEnrolment.deleteMany({ where: { memberId } });

  await writeAudit(
    {
      actorId,
      action: "member.face_enrolment_deleted_on_status_change",
      entity: "Member",
      entityId: memberId,
      before: { hadFaceEnrolment: true },
      after: { hadFaceEnrolment: false, newStatus },
    },
    tx,
  );
}
