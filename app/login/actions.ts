"use server";

import { AuthError } from "next-auth";
import { signIn, AccountLockedError, LoginRateLimitedError } from "@/auth";

// Rate limiting, account lockout and the timing-safe comparison that
// keeps an unresolvable identifier indistinguishable from a wrong
// password all live in auth.ts's authorize(), the one place neither this
// action nor a direct hit on NextAuth's own callback route can bypass.
// This action's only job is turning whatever it catches back from that
// into a message a person reads.
export async function login(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      identifier: formData.get("identifier"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
  } catch (error) {
    // next-auth throws a redirect internally on success. Only report an
    // actual sign in failure, and let anything else (including the
    // redirect) propagate.
    if (error instanceof AccountLockedError) {
      const minutes = Math.ceil(error.retryAfterSeconds / 60);
      return `Too many failed attempts for this account. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
    }
    if (error instanceof LoginRateLimitedError) {
      const minutes = Math.ceil(error.retryAfterSeconds / 60);
      return `Too many attempts from this connection. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
    }
    if (error instanceof AuthError) {
      return "That member number, email, phone or password is not recognised.";
    }
    throw error;
  }
}
