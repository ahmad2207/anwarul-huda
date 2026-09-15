"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;

export async function login(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const ip = await getClientIp();
  const rateLimit = checkRateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_SECONDS);
  if (!rateLimit.allowed) {
    const minutes = Math.ceil((rateLimit.retryAfterSeconds ?? LOGIN_WINDOW_SECONDS) / 60);
    return `Too many attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }

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
    if (error instanceof AuthError) {
      return "That email, phone or password is not recognised.";
    }
    throw error;
  }
}
