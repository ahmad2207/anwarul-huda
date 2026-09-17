import { prisma } from "@/lib/prisma";

// The shared, storage-level primitive behind both lib/rate-limit.ts (per
// IP, and anything else counting every attempt) and lib/login-lockout.ts
// (per account, counting only failures). Neither of those files knows
// this is a table; both just ask for a counter by key.
//
// Postgres, not in-process memory, because the deployment target is
// Vercel: multiple concurrent instances and cold starts that remember
// nothing between invocations. An in-memory Map only ever counts the
// requests that happen to land on the same warm instance, so under real
// traffic spread across instances a limit meant to allow 10 attempts
// could in practice allow 10 per instance, and a lockout meant to hold
// for 15 minutes could reset the moment a request lands on an instance
// that never saw the earlier failures. Neither failure mode is visible
// in local development, where there is only ever one instance, which is
// exactly why it needs calling out rather than discovering later.

export interface CounterState {
  count: number;
  expiresAt: Date;
}

/**
 * Increments the counter for `key`, starting a fresh window if none
 * exists yet or the previous one has expired, and returns the count and
 * expiry that resulted. One atomic statement: the INSERT and the
 * conditional "new window or same window" logic in the ON CONFLICT
 * clause happen as a single row-level operation, so two concurrent
 * increments for the same key (two Vercel invocations landing at the
 * same instant) serialise against each other at the database rather
 * than racing a separate read-then-write the way a naive
 * "SELECT, then UPDATE" pair would. Whichever commits second sees the
 * first's result and increments from there; neither can silently
 * overwrite the other's count.
 */
export async function incrementCounter(key: string, windowSeconds: number): Promise<CounterState> {
  const newExpiresAt = new Date(Date.now() + windowSeconds * 1000);

  const rows = await prisma.$queryRaw<{ count: number; expires_at: Date }[]>`
    INSERT INTO rate_limit_counters (key, count, window_start, expires_at, updated_at)
    VALUES (${key}, 1, now(), ${newExpiresAt}, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_counters.expires_at <= now() THEN 1
        ELSE rate_limit_counters.count + 1
      END,
      window_start = CASE
        WHEN rate_limit_counters.expires_at <= now() THEN now()
        ELSE rate_limit_counters.window_start
      END,
      expires_at = CASE
        WHEN rate_limit_counters.expires_at <= now() THEN ${newExpiresAt}
        ELSE rate_limit_counters.expires_at
      END,
      updated_at = now()
    RETURNING count, expires_at
  `;

  const row = rows[0];
  return { count: row.count, expiresAt: row.expires_at };
}

/** Reads the counter for `key` without incrementing it. Null if it does not exist or its window has already expired. */
export async function getCounter(key: string): Promise<CounterState | null> {
  const row = await prisma.rateLimitCounter.findUnique({ where: { key } });
  if (!row || row.expiresAt <= new Date()) {
    return null;
  }
  return { count: row.count, expiresAt: row.expiresAt };
}

/** Removes the counter for `key` entirely, so the next increment starts a fresh window. */
export async function deleteCounter(key: string): Promise<void> {
  await prisma.rateLimitCounter.deleteMany({ where: { key } });
}

/**
 * Deletes every counter whose window has already expired. Called two
 * ways: opportunistically, on a small fraction of ordinary requests (see
 * lib/rate-limit.ts), the same fallback lib/rate-limit.ts's own
 * in-memory predecessor used; and on a schedule, from
 * app/api/cron/cleanup-rate-limits/route.ts, which is the one to rely
 * on, since Vercel's serverless instances do not sit around between
 * requests the way the opportunistic sweep's "a small fraction of calls"
 * assumes a long-running process would.
 */
export async function cleanupExpiredCounters(): Promise<number> {
  const result = await prisma.rateLimitCounter.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return result.count;
}
