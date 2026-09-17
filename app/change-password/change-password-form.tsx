"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { changePassword } from "./actions";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [error, formAction, isPending] = useActionState(changePassword, undefined);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small static asset, not one next/image needs to optimise */}
        <img src="/logo.png" alt="Anwaru-l-Huda League of Nigeria" width={96} height={96} className="mb-2" />
        <CardTitle>{forced ? "Choose a new password" : "Change your password"}</CardTitle>
        <CardDescription>
          {forced
            ? "You are signing in with a temporary password. Set your own before you can continue."
            : "Enter your current password and choose a new one."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="currentPassword">{forced ? "Temporary password" : "Current password"}</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
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
            />
            <p className="text-xs text-muted-foreground">
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
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Saving..." : "Set new password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
