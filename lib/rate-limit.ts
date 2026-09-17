import { headers } from "next/headers";
import { cleanupExpiredCounters, incrementCounter } from "@/lib/rate-limit-store";

// A fixed window rate limiter backed by Postgres (lib/rate-limit-store.ts),
// so it holds across the multiple concurrent, ephemeral instances this
// app runs as on Vercel, not just within one warm process. See
// rate-limit-store.ts for how a concurrent increment is made safe.

// A stale counter (its window long expired) is worth forgetting so the
// table does not grow without bound. Rather than only relying on the
// scheduled cleanup route (app/api/cron/cleanup-rate-limits), a sweep
// also runs opportunistically on a small fraction of calls, the same
// role this played for the in-memory version this replaced: a cheap,
// no-configuration-required backstop if the scheduled job is ever not
// running, not the primary mechanism.
const SWEEP_PROBABILITY = 0.01;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/** Allows at most `limit` calls per `windowSeconds` for a given key, resetting once the window elapses. */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  if (Math.random() < SWEEP_PROBABILITY) {
    // Deliberately not awaited: a maintenance sweep should never make the
    // request that happened to trigger it wait on it.
    void cleanupExpiredCounters();
  }

  const { count, expiresAt } = await incrementCounter(key, windowSeconds);

  if (count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

/**
 * The caller's IP, read off the headers a proxy in front of this app
 * sets (Vercel, and most others, set x-forwarded-for). Falls back to a
 * fixed key when neither header is present, for example a direct
 * connection in local development, which then rate limits all such
 * traffic together rather than not at all.
 *
 * next/headers only works inside an actual request (a real form
 * submission running through Next's server, not calling the action
 * function directly), which registration and login's own integration
 * tests do on purpose, to exercise the real transaction without a
 * browser. Falling back the same way here keeps that possible: a test
 * run is not a real client to rate limit in the first place.
 */
export async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0].trim();
    }
    return headerList.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}
