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
  /** Present, and nothing changed, when at least one member cannot be safely undone. */
  blockers?: RollbackBlocker[];
  deactivatedCount?: number;
}

/**
 * Undoes a committed import batch: every member it created is set to
 * INACTIVE, with a reason and a date, as long as none of them have a
 * payment or an attendance record against them. If any do, nothing is
 * changed and the caller gets back exactly which members are blocking it,
 * so this refuses loudly rather than silently doing a partial rollback.
 *
 * This never deletes a Member row. CLAUDE.md domain rule 1 is
 * unconditional: member records are never hard deleted, only status
 * changed, and a mistaken bulk import is not an exception to that. An
 * earlier version of this function did delete the rows outright; that was
 * a real gap, caught and corrected in the Phase 7 security pass, not a
 * deliberate design.
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
    return { deactivatedCount: 0 };
  }

  const now = new Date();
  const auditEntries: Parameters<typeof writeAuditMany>[0] = [];

  for (const member of members) {
    const updated = await tx.member.update({
      where: { id: member.id },
      data: {
        status: "INACTIVE",
        statusReason: "Import batch rolled back",
        statusAt: now,
      },
    });
    auditEntries.push({
      actorId,
      action: "member.deactivated_via_import_rollback",
      entity: "Member",
      entityId: member.id,
      before: { status: member.status },
      after: { status: updated.status, statusReason: updated.statusReason, statusAt: updated.statusAt },
    });
  }

  await writeAuditMany(auditEntries, tx);

  return { deactivatedCount: members.length };
}
