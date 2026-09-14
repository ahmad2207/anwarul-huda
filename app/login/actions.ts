"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

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
    if (error instanceof AuthError) {
      return "That email, phone or password is not recognised.";
    }
    throw error;
  }
}
