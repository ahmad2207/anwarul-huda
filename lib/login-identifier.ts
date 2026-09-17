import { normalizeMemberNumberInput } from "@/lib/member-number";
import { normalizeNigerianPhone } from "@/lib/phone";

// What kind of thing was typed into the login form, decided once and
// shared by every caller that needs the same answer: auth.ts, to know
// which column to look the account up by, and lib/login-lockout.ts (via
// auth.ts), to key a lockout bucket that punctuation cannot be used to
// dodge (see MEMBER-INTERFACE.md 2, "ahl m 2026 0113" and
// "AHLM20260113" are the same login attempt, not two separate ones with
// two separate allowances of failed guesses).

export type ClassifiedLoginIdentifier =
  | { kind: "memberNumber"; canonical: string }
  | { kind: "email"; canonical: string }
  | { kind: "phone"; canonical: string }
  | { kind: "unrecognised"; canonical: string };

/**
 * Classifies a raw login identifier and normalises it to the canonical
 * form its own kind uses for comparison. Member number is checked first:
 * its format is the most constrained of the three, so nothing else can
 * be mistaken for one.
 */
export function classifyLoginIdentifier(raw: string): ClassifiedLoginIdentifier {
  const memberNumber = normalizeMemberNumberInput(raw);
  if (memberNumber) {
    return { kind: "memberNumber", canonical: memberNumber };
  }

  if (raw.includes("@")) {
    return { kind: "email", canonical: raw.trim().toLowerCase() };
  }

  try {
    return { kind: "phone", canonical: normalizeNigerianPhone(raw) };
  } catch {
    return { kind: "unrecognised", canonical: raw.trim().toLowerCase() };
  }
}
