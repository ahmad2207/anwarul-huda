import { headers } from "next/headers";

// A fixed window rate limiter, in memory. This is correct for a single
// long running process, which is how this app runs today (`next start`
// on one instance). It is NOT correct for multiple concurrent serverless
// instances or a horizontally scaled deployment, since each instance
// would keep its own separate counters and an attacker spread across
// instances would never trip any one of them. A production deployment
// that actually scales out would need a shared store instead, a new
// Prisma table or a service such as Upstash Redis, either of which is a
// real infrastructure decision to agree first, not something to add
// silently here. Flagged plainly rather than pretending this is
// production-hardened as it stands.

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// A stale bucket (its window long expired) is worth forgetting so this
// map does not grow without bound over a long process lifetime. Rather
// than a timer, which would need its own lifecycle management, a sweep
// runs opportunistically on a small fraction of calls.
const SWEEP_PROBABILITY = 0.01;
const MAX_BUCKET_AGE_MS = 60 * 60 * 1000; // an hour: longer than any window this app actually uses

function sweepStaleBuckets(now: number): void {
  if (Math.random() > SWEEP_PROBABILITY) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > MAX_BUCKET_AGE_MS) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/** Allows at most `limit` calls per `windowSeconds` for a given key, resetting once the window elapses. */
export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweepStaleBuckets(now);

  const windowMs = windowSeconds * 1000;
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.count += 1;
  return { allowed: true };
}

/** Only exported for tests, so a test does not leak state into another test's keys. */
export function resetRateLimitForTests(): void {
  buckets.clear();
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
