import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "./rate-limit";

// Integration test against the real local Postgres database: this is
// exactly the behaviour that matters (lib/rate-limit-store.ts's atomic
// upsert, not a mock of it), the same reasoning lib/member-number.test.ts
// gives for testing generateMemberNumber's advisory lock against the
// real database rather than a fake.

const FIXTURE_PREFIX = `RateLimitFixture${Date.now()}`;
let counter = 0;
function fixtureKey(): string {
  counter += 1;
  return `${FIXTURE_PREFIX}:${counter}`;
}

const SETUP_WINDOW_SECONDS = 10;
// Expiry is set from this machine's clock but compared against the
// database's, so allow for the two disagreeing by up to this much.
const CLOCK_MARGIN_MS = 2000;

describe("checkRateLimit", () => {
  afterAll(async () => {
    await prisma.rateLimitCounter.deleteMany({ where: { key: { startsWith: FIXTURE_PREFIX } } });
    await prisma.$disconnect();
  });

  it("allows calls up to the limit within the window", async () => {
    const key = fixtureKey();
    for (let i = 0; i < 5; i++) {
      expect((await checkRateLimit(key, 5, 60)).allowed).toBe(true);
    }
  });

  it("refuses the call once the limit is reached within the window", async () => {
    const key = fixtureKey();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, 5, 60);
    }
    const result = await checkRateLimit(key, 5, 60);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps different keys entirely independent", async () => {
    const keyC = fixtureKey();
    const keyD = fixtureKey();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(keyC, 5, 60);
    }
    expect((await checkRateLimit(keyC, 5, 60)).allowed).toBe(false);
    expect((await checkRateLimit(keyD, 5, 60)).allowed).toBe(true); // a different key, untouched
  });

  it("allows calls again once the window has elapsed", async () => {
    const key = fixtureKey();
    // The window has to outlast four sequential round trips, which on a
    // remote database can take several seconds, or it expires before the
    // limit is reached and the fourth call is allowed. So it is generous,
    // and the test then waits for the expiry actually stored rather than
    // a fixed sleep.
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(key, 3, SETUP_WINDOW_SECONDS);
    }
    expect((await checkRateLimit(key, 3, SETUP_WINDOW_SECONDS)).allowed).toBe(false);

    const row = await prisma.rateLimitCounter.findUniqueOrThrow({ where: { key } });
    const waitMs = Math.max(0, row.expiresAt.getTime() - Date.now()) + CLOCK_MARGIN_MS;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    expect((await checkRateLimit(key, 3, SETUP_WINDOW_SECONDS)).allowed).toBe(true);
  }, 30_000);

  it("serialises concurrent increments for the same key rather than losing any of them", async () => {
    const key = fixtureKey();
    const concurrency = 10;

    const results = await Promise.all(Array.from({ length: concurrency }, () => checkRateLimit(key, 100, 60)));

    // Ten concurrent callers, none of them racing a stale read: the
    // counter after all ten have landed must be exactly ten, not less.
    const counter = await prisma.rateLimitCounter.findUniqueOrThrow({ where: { key } });
    expect(counter.count).toBe(concurrency);
    expect(results.every((r) => r.allowed)).toBe(true);
  });
});
