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
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(key, 3, 1);
    }
    expect((await checkRateLimit(key, 3, 1)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1500)); // generous margin over the DB round trip
    expect((await checkRateLimit(key, 3, 1)).allowed).toBe(true);
  });

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
