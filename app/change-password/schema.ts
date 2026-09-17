import { z } from "zod";
import { MIN_PASSWORD_LENGTH, isCommonPassword } from "@/lib/password-policy";

// Applies to both the forced first change and any later, voluntary one:
// both submit through this same schema. No complexity rule and no
// forced rotation, per lib/password-policy.ts's own reasoning; only
// length and the common-password check.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      .refine((value) => !isCommonPassword(value), {
        message: "This password is too common and easy to guess. Choose a less predictable one.",
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Choose a password different from the one you are replacing",
    path: ["newPassword"],
  });
