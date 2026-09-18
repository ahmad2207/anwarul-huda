"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { changePassword } from "@/app/change-password/actions";

// The same server action, the same schema and the same password policy
// as registration and the forced first change (lib/password-policy.ts):
// a password accepted here is accepted everywhere, and one rejected
// here is rejected everywhere. A successful change still runs through
// that action's own redirect, which for an account with no staff role
// is /account, so there is no separate settings-only outcome to keep in
// step with the other two call sites.
export function SettingsPasswordForm() {
  const [error, formAction, isPending] = useActionState(changePassword, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className="h-11 text-base"
        />
        <p className="text-sm text-muted-foreground">
          At least {MIN_PASSWORD_LENGTH} characters, and not one of the passwords everyone tries first.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className="h-11 text-base"
        />
      </div>
      {error ? <p className="text-base text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="h-11 self-start rounded-[4px] px-6 text-base">
        {isPending ? "Saving..." : "Save new password"}
      </Button>
    </form>
  );
}
