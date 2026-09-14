import type { Prisma } from "@prisma/client";
import { writeAuditMany } from "@/lib/audit";

export interface RollbackBlocker {
  memberId: string;
  memberNumber: string | null;
  surname: string;
  firstName: string;
  reason: "payments" | "attendance" | "both";
}

export interface RollbackResult {
  /** Present, and nothing removed, when at least one member cannot be safely undone. */
  blockers?: RollbackBlocker[];
  removedCount?: number;
}

/**
 * Undoes a committed import batch in full: every member it created is
 * removed, as long as none of them have a payment or an attendance record
 * against them. If any do, nothing is removed and the caller gets back
 * exactly which members are blocking it, so this refuses loudly rather
 * than silently doing a partial rollback.
 */
export async function rollbackImportBatch(
  tx: Prisma.TransactionClient,
  batchId: string,
  actorId: string,
): Promise<RollbackResult> {
  const members = await tx.member.findMany({
    where: { importBatchId: batchId },
    include: {
      _count: { select: { payments: true, attendance: true } },
    },
  });

  const blockers: RollbackBlocker[] = [];
  for (const member of members) {
    const hasPayments = member._count.payments > 0;
    const hasAttendance = member._count.attendance > 0;
    if (hasPayments || hasAttendance) {
      blockers.push({
        memberId: member.id,
        memberNumber: member.memberNumber,
        surname: member.surname,
        firstName: member.firstName,
        reason: hasPayments && hasAttendance ? "both" : hasPayments ? "payments" : "attendance",
      });
    }
  }

  if (blockers.length > 0) {
    return { blockers };
  }

  if (members.length === 0) {
    return { removedCount: 0 };
  }

  const memberIds = members.map((member) => member.id);

  // Household rows are auxiliary to the member being undone here, so they
  // are removed along with it. They are not one of the two things that
  // block a rollback, above, because they carry no independent activity
  // of their own the way a payment or an attendance record does.
  await tx.householdMember.deleteMany({ where: { memberId: { in: memberIds } } });

  await writeAuditMany(
    members.map((member) => ({
      actorId,
      action: "member.removed_via_import_rollback",
      entity: "Member",
      entityId: member.id,
      before: member,
      after: null,
    })),
    tx,
  );

  await tx.member.deleteMany({ where: { id: { in: memberIds } } });

  return { removedCount: memberIds.length };
}
