"use client";

import Link from "next/link";
import { Field, FormError, primaryButtonClass } from "@/components/member/form";
import { PublicCard } from "@/components/member/public-frame";
import { useRememberedForm } from "@/components/member/use-remembered-form";
import { login } from "./actions";

export function LoginForm() {
  // The identifier is kept after a failed attempt so a wrong password
  // does not also mean retyping the member number. The password is not.
  const { state: error, formAction, isPending, value } = useRememberedForm(login, undefined);

  return (
    <PublicCard
      title="Sign in"
      lead="Use the member number on your card, for example AHL/M/2026/0113. Punctuation and capital letters do not matter. Administrators sign in with their email instead."
    >
      <form action={formAction} className="flex flex-col gap-5">
        <Field
          label="Member number, email or phone number"
          id="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          required
          defaultValue={value("identifier", "")}
        />
        <Field label="Password" id="password" type="password" autoComplete="current-password" required />
        <FormError>{error}</FormError>
        <button type="submit" disabled={isPending} className={`${primaryButtonClass} w-full`}>
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-base text-ink-2">
        Not a member yet?{" "}
        <Link href="/register" className="font-semibold text-navy-700 underline underline-offset-4">
          Register here
        </Link>
      </p>
    </PublicCard>
  );
}
