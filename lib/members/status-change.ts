import type { Member, MemberStatus, Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { deleteFaceEnrolmentsOnDeactivation } from "@/lib/face/delete-enrolments-on-deactivation";

export class MemberStatusChangeError extends Error {}

export interface ApplyMemberStatusChangeInput {
  newStatus: MemberStatus;
  reason: string;
  effectiveDate: Date;
  actorId: string;
}

/**
 * Changes a member's status and, if the new status is INACTIVE or
 * DECEASED, deactivates their linked login, reactivating it if they are
 * later restored to ACTIVE. These are the two statuses CLAUDE.md's domain
 * rule 1 names as the deactivation path for a member record; the other
 * statuses (occasional, relocated, honorary) are still ongoing
 * membership, so login access is left untouched for those.
 *
 * Every write here is audited, the member's own record and the user's
 * separately, since domain rule 7 names users as its own audited entity,
 * not something to fold into the member's audit entry. A gap here (the
 * user was never deactivated at all, and its own writes were never
 * separately audited) was caught and fixed in the Phase 7 security pass.
 */
export async function applyMemberStatusChange(
  tx: Prisma.TransactionClient,
  before: Member,
  input: ApplyMemberStatusChangeInput,
): Promise<Member> {
  // An applicant becomes a member only through approval, which issues the
  // member number, records the approver and runs the duplicate check. A
  // status change must not be a way around that.
  if (before.status === "PENDING" || before.status === "REJECTED") {
    throw new MemberStatusChangeError(
      "This person has not been approved as a member. Use the approvals queue instead.",
    );
  }

  // Conditional on the status the officer saw, so two changes made at the
  // same moment cannot both apply with one silently overwriting the other.
  const changed = await tx.member.updateMany({
    where: { id: before.id, status: before.status },
    data: {
      status: input.newStatus,
      statusReason: input.reason,
      statusAt: input.effectiveDate,
    },
  });
  if (changed.count === 0) {
    throw new MemberStatusChangeError("This member's status has changed since you opened the page. Reload and try again.");
  }
  const updated = await tx.member.findUniqueOrThrow({ where: { id: before.id } });

  await writeAudit(
    {
      actorId: input.actorId,
      action: "member.status_changed",
      entity: "Member",
      entityId: before.id,
      before: { status: before.status, statusReason: before.statusReason },
      after: { status: updated.status, statusReason: updated.statusReason, statusAt: updated.statusAt },
    },
    tx,
  );

  // SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md 4.5: retention written into the
  // code, alongside the same two statuses that already deactivate a
  // linked login just below.
  await deleteFaceEnrolmentsOnDeactivation(tx, before.id, input.newStatus, input.actorId);

  const linkedUser = await tx.user.findUnique({ where: { memberId: before.id } });
  if (linkedUser) {
    const shouldDeactivate =
      (input.newStatus === "INACTIVE" || input.newStatus === "DECEASED") && linkedUser.isActive;
    const shouldReactivate = input.newStatus === "ACTIVE" && !linkedUser.isActive;

    if (shouldDeactivate || shouldReactivate) {
      const updatedUser = await tx.user.update({
        where: { id: linkedUser.id },
        data: { isActive: shouldReactivate },
      });
      await writeAudit(
        {
          actorId: input.actorId,
          action: shouldReactivate ? "user.reactivated" : "user.deactivated",
          entity: "User",
          entityId: linkedUser.id,
          before: { isActive: linkedUser.isActive },
          after: { isActive: updatedUser.isActive },
        },
        tx,
      );
    }
  }

  return updated;
}
