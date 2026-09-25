import { z } from "zod";
import { normalizeNigerianPhone } from "@/lib/phone";
import { parseLagosDateTimeLocal } from "@/lib/timezone";

// Shared building blocks for the member Zod schemas (registration and the
// admin edit form both describe the same paper form, so both need the
// same "empty string means not provided" and phone normalisation rules).

// FormData.get() returns null for a field that was never sent at all (as
// opposed to sent with an empty value), so both cases have to be treated
// as "not provided" here, not just the empty string a browser sends for a
// blank text input.
export function emptyToUndefined(value: unknown): unknown {
  if (value === null) {
    return undefined;
  }
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export function toStringList(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Wraps a schema so a null, missing, or blank form field validates as
 * undefined instead of failing.
 *
 * `z.preprocess(emptyToUndefined, schema).optional()` looks like it should
 * do this but does not: `.optional()` on the outside only short circuits
 * when the raw input is already `undefined`. A `null` or `""` input still
 * reaches the preprocess function, which correctly turns it into
 * `undefined`, but that `undefined` is then handed to `schema` itself,
 * which was never made optional, so it fails. The fix is to put
 * `.optional()` on the inner schema instead, so the value produced by the
 * preprocess step is what actually gets checked for optionality.
 */
export function optionalField<Schema extends z.ZodTypeAny>(schema: Schema) {
  return z.preprocess(emptyToUndefined, schema.optional());
}

export function optionalText(max: number) {
  return optionalField(z.string().trim().max(max));
}

export function requiredPhone(label: string) {
  return z
    .string()
    .min(1, `${label} is required`)
    .transform((value, ctx) => {
      try {
        return normalizeNigerianPhone(value);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} is not a recognisable Nigerian phone number`,
        });
        return z.NEVER;
      }
    });
}

export function optionalPhone(label: string) {
  return optionalField(z.string()).transform((value, ctx) => {
    if (value === undefined) {
      return undefined;
    }
    try {
      return normalizeNigerianPhone(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} is not a recognisable Nigerian phone number`,
      });
      return z.NEVER;
    }
  });
}

/**
 * A datetime-local input ("YYYY-MM-DDTHH:mm"), read as Lagos time. The
 * people typing it are in Lagos; z.coerce.date() or new Date() would read
 * the same string in the server's own zone instead, which on a UTC server
 * puts every time an hour late.
 */
export function lagosDateTime(requiredMessage: string, invalidMessage: string) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .transform((value, ctx) => {
      const instant = parseLagosDateTimeLocal(value);
      if (!instant) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: invalidMessage });
        return z.NEVER;
      }
      return instant;
    });
}

/** The same, for a field that may be left blank. */
export function optionalLagosDateTime(invalidMessage: string) {
  return optionalField(lagosDateTime(invalidMessage, invalidMessage));
}
