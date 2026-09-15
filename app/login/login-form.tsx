"use client";

import { useActionState } from "react";
import Link from "next/link";
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
import { login } from "./actions";

export function LoginForm() {
  const [error, formAction, isPending] = useActionState(login, undefined);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small static asset, not one next/image needs to optimise */}
        <img src="/logo.png" alt="Anwaru-l-Huda League of Nigeria" width={96} height={96} className="mb-2" />
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Use the email or phone number on your member account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="identifier">Email or phone number</Label>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Not a member yet?{" "}
          <Link href="/register" className="underline underline-offset-4">
            Register here
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
