"use client";

import { useActionState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { Field, FormError, primaryButtonClass } from "@/components/member/form";
import { PublicCard } from "@/components/member/public-frame";
import { changePassword } from "./actions";

// Password fields are deliberately not refilled after an error.
export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [error, formAction, isPending] = useActionState(changePassword, undefined);

  return (
    <PublicCard
      title={forced ? "Choose a new password" : "Change your password"}
      lead={
        forced
          ? "You are signing in with a temporary password. Set your own before you can continue."
          : "Enter your current password and choose a new one."
      }
    >
      <form action={formAction} className="flex flex-col gap-5">
        <Field
          label={forced ? "Temporary password" : "Current password"}
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
        <button type="submit" disabled={isPending} className={`${primaryButtonClass} w-full`}>
          {isPending ? "Saving..." : "Set new password"}
        </button>
      </form>
    </PublicCard>
  );
}
