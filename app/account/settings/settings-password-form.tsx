"use client";

import { useActionState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { Field, FormError, primaryButtonClass } from "@/components/member/form";
import { changePassword } from "@/app/change-password/actions";

// The same server action, the same schema and the same password policy
// as registration and the forced first change (lib/password-policy.ts):
// a password accepted here is accepted everywhere, and one rejected
// here is rejected everywhere. Password fields are deliberately not
// refilled after an error.
export function SettingsPasswordForm() {
  const [error, formAction, isPending] = useActionState(changePassword, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Current password"
        id="currentPassword"
        type="password"
        autoComplete="current-password"
        required
      />
      <Field
        label="New password"
        id="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
        hint={`At least ${MIN_PASSWORD_LENGTH} characters, and not one of the passwords everyone tries first.`}
      />
      <Field
        label="Confirm new password"
        id="confirmPassword"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
      />
      <FormError>{error}</FormError>
      <button type="submit" disabled={isPending} className={`${primaryButtonClass} self-start`}>
        {isPending ? "Saving..." : "Save new password"}
      </button>
    </form>
  );
}
