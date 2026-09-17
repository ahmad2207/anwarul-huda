"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { accountLockoutKey, clearAccountLockout } from "@/lib/login-lockout";
import { changePasswordSchema } from "./schema";

const PASSWORD_HASH_ROUNDS = 12;

export async function changePassword(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the values you entered and try again.";
  }

  const user = await getCurrentUser();

  const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!record.passwordHash) {
    return "This account has no password set. Contact an administrator.";
  }

  const currentMatches = await bcrypt.compare(parsed.data.currentPassword, record.passwordHash);
  if (!currentMatches) {
    return "Your current password is not correct.";
  }

  const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, PASSWORD_HASH_ROUNDS);
  const wasForced = record.mustChangePassword;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
    },
  });

  // A successful change is exactly the kind of thing that should clear
  // any accumulated failures against this account: whatever was
  // happening before (a member who mistyped their temporary password a
  // few times, or genuinely was being guessed at), a correct current
  // password just proved is over.
  await clearAccountLockout(accountLockoutKey(user.id));

  // Never the password itself, before or after: only that a change
  // happened, and whether it was the forced first change after a
  // temporary password was issued, which is what point 8 asks this
  // action to be distinguishable as in the log.
  await writeAudit({
    actorId: user.id,
    action: wasForced ? "user.password_changed_after_issue" : "user.password_changed",
    entity: "User",
    entityId: user.id,
    before: { mustChangePassword: wasForced },
    after: { mustChangePassword: false },
  });

  // A member (no staff role) whose change was forced is on their very
  // first login: MEMBER-INTERFACE.md 3.6 wants the welcome screen
  // between this and the record, shown exactly once, which this
  // sequencing guarantees on its own (mustChangePassword only ever
  // flips true to false the one time) without a separate "have they
  // seen it" flag to track. A voluntary change, or a staff account, is
  // unaffected.
  const isFirstMemberLogin = user.roles.length === 0 && wasForced;
  redirect(isFirstMemberLogin ? "/account/welcome" : user.roles.length === 0 ? "/account" : "/admin");
}
