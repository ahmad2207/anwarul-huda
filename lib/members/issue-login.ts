import type { Member, Prisma, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeAudit } from "@/lib/audit";
import { generateTemporaryPassword } from "@/lib/credentials";

const PASSWORD_HASH_ROUNDS = 12;

export class IssueLoginError extends Error {}

export interface IssueLoginResult {
  userId: string;
  /**
   * The plaintext temporary password. Returned exactly once, to the
   * caller of this function alone. Nothing below this point holds it:
   * the database only ever receives its bcrypt hash (passwordHash), and
   * the audit entry this writes carries no password field at all, only
   * that an issue happened, for whom, and when.
   */
  temporaryPassword: string;
  isReissue: boolean;
}

/**
 * Issues or reissues a member's login: generates a fresh temporary
 * password, hashes it, creates the linked User if none exists yet or
 * overwrites the existing one's hash if it does, and sets
 * mustChangePassword so the forced change in app/change-password is the
 * only place the account can reach until it is used.
 *
 * The only requirement is a member number (MEMBER-INTERFACE.md 2: it is
 * the login identifier now, not phone, precisely because almost none of
 * the 289 imported members have a phone on file at all). Phone is no
 * longer read or required here; where a member happens to already have
 * one, it is left exactly as it is.
 *
 * A reissue invalidates the previous temporary password outright: this
 * overwrites passwordHash rather than adding to it, so the old value
 * stops working the moment this commits, whether or not it was ever
 * used. First issue and reissue are told apart by whether member.user is
 * already present, and are audited under different action names for
 * exactly that reason (MEMBER-INTERFACE.md 2, point 5 of the credential
 * issue prompt).
 *
 * Kept separate from the "use server" action in
 * app/admin/members/[id]/credentials-actions.ts, which only adds the
 * auth and wing-access checks, so this can be exercised directly in a
 * test with a plain actor id instead of a real session, the same way
 * lib/import/compute-preview.ts and lib/members/status-change.ts are.
 */
export async function issueLoginForMember(
  tx: Prisma.TransactionClient,
  member: Member & { user: User | null },
  actorId: string,
): Promise<IssueLoginResult> {
  if (!member.memberNumber) {
    throw new IssueLoginError(
      "This member has no member number yet. A member number is issued on approval, before a login can be issued.",
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
  const now = new Date();
  const isReissue = member.user !== null;
  const previousMustChangePassword = member.user?.mustChangePassword ?? null;

  const userId = member.user
    ? (
        await tx.user.update({
          where: { id: member.user.id },
          data: {
            passwordHash,
            isActive: true,
            mustChangePassword: true,
            temporaryPasswordIssuedAt: now,
            temporaryPasswordIssuedById: actorId,
          },
        })
      ).id
    : (
        await tx.user.create({
          data: {
            // Carried over if the import or the member themselves ever
            // set one, but never required: login does not depend on it.
            phone: member.phone,
            email: member.email,
            passwordHash,
            isActive: true,
            mustChangePassword: true,
            temporaryPasswordIssuedAt: now,
            temporaryPasswordIssuedById: actorId,
            memberId: member.id,
          },
        })
      ).id;

  // What happened, who did it, when, and for which user: the entire
  // content of both an issue and a reissue entry. Never the password,
  // in either before or after, here or anywhere else.
  await writeAudit(
    {
      actorId,
      action: isReissue ? "user.credentials_reissued" : "user.credentials_issued",
      entity: "User",
      entityId: userId,
      before: isReissue ? { mustChangePassword: previousMustChangePassword } : null,
      after: { mustChangePassword: true, temporaryPasswordIssuedAt: now.toISOString() },
    },
    tx,
  );

  return { userId, temporaryPassword, isReissue };
}
