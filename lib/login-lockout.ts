import { deleteCounter, getCounter, incrementCounter } from "@/lib/rate-limit-store";

// Per-account login lockout, on the same Postgres backed counters as
// lib/rate-limit.ts's per-IP limit (lib/rate-limit-store.ts), for the
// same reason: Vercel runs this app as multiple concurrent, ephemeral
// instances, and an in-memory counter would not reliably accumulate
// across them, so the lockout would not reliably hold in production.
//
// Keyed by resolved user id, not by the identifier string that was
// typed in: a member number, an email and a phone number resolving to
// the same account must all count against the one bucket, or an
// attacker gets three times the allowance simply by trying each kind in
// turn. See auth.ts's authorize(), the only caller: it resolves the
// identifier to a user first, and only then asks this module about the
// resulting key. When resolution finds no account at all, the caller
// still needs a key: buildUnknownIdentifierKey gives one that is
// namespaced away from every real user id, so a flood of guesses
// against identifiers that do not exist gets its own bucket rather than
// silently bypassing the lockout altogether by never landing in a real
// account's bucket.

// Five failures, fifteen minutes. Reasoning:
//
// - Fifteen minutes matches the existing per-IP window (auth.ts), one
//   constant meaning to hold in mind rather than two.
// - Five is tight enough that grinding through a dictionary of common
//   passwords against one account is impractical (at most 20 guesses an
//   hour), while loose enough that a member who mistypes their own
//   password two or three times, which genuinely happens, is not locked
//   out for an ordinary slip.
// - The lockout expires on its own rather than needing an administrator
//   to clear it. A lockout that only an administrator can lift is also a
//   denial of service an attacker can inflict deliberately: fail five
//   attempts against a member's real account on purpose, and that member
//   is locked out until someone notices and intervenes. A temporary,
//   self-expiring lockout keeps the cost of guessing high without
//   handing an attacker that lever. This is the standard trade-off OWASP
//   recommends for exactly this reason.
// - A freshly issued temporary password is drawn from a 57 character
//   alphabet at 10 characters (lib/credentials.ts), around 58 bits of
//   entropy: no realistic number of attempts finds that by guessing.
//   What this actually defends is a member's own, self-chosen password
//   after their first change, now at least 10 characters and checked
//   against a common-password list (lib/password-policy.ts), but still
//   guessable in principle. That is the real target of this policy.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_SECONDS = 15 * 60;

export interface LockoutStatus {
  locked: boolean;
  retryAfterSeconds?: number;
}

/** The lockout key for a resolved account. */
export function accountLockoutKey(userId: string): string {
  return `lockout:user:${userId}`;
}

/**
 * The lockout key for an identifier that resolved to no account at all,
 * namespaced by what kind of identifier it looked like (member number,
 * email, phone, or none of those) so a member number and an email that
 * happen to normalise to the same text still do not collide. Kept
 * separate from accountLockoutKey's namespace entirely: no user id ever
 * collides with this format, so a real account's failures and a probe
 * against a nonexistent one are never the same counter.
 */
export function unknownIdentifierLockoutKey(kind: string, canonical: string): string {
  return `lockout:unknown:${kind}:${canonical}`;
}

/**
 * Whether this key is currently locked out from too many recent
 * failures. Call before every login attempt; this does not itself count
 * as an attempt, only recordLoginFailure does.
 */
export async function checkAccountLockout(lockoutKey: string): Promise<LockoutStatus> {
  const counter = await getCounter(lockoutKey);
  if (!counter) {
    return { locked: false };
  }
  if (counter.count >= LOCKOUT_THRESHOLD) {
    const retryAfterSeconds = Math.max(1, Math.ceil((counter.expiresAt.getTime() - Date.now()) / 1000));
    return { locked: true, retryAfterSeconds };
  }
  return { locked: false };
}

/** Records one failed attempt against this key, towards the lockout threshold. */
export async function recordLoginFailure(lockoutKey: string): Promise<void> {
  await incrementCounter(lockoutKey, LOCKOUT_WINDOW_SECONDS);
}

/**
 * Clears any accumulated failures for this key immediately, rather than
 * waiting for the window to expire on its own: called on a successful
 * login and on a successful password change (auth.ts, app/change-
 * password/actions.ts), so a member who eventually gets their password
 * right, or replaces it, is not left carrying a near-threshold count
 * into whatever they do next.
 */
export async function clearAccountLockout(lockoutKey: string): Promise<void> {
  await deleteCounter(lockoutKey);
}
