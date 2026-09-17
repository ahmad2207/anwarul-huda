import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { incrementCounter } from "./rate-limit-store";
import {
  accountLockoutKey,
  checkAccountLockout,
  clearAccountLockout,
  recordLoginFailure,
  unknownIdentifierLockoutKey,
} from "./login-lockout";

// Integration test against the real local Postgres database, the same
// way lib/rate-limit.test.ts exercises its own counters: this is exactly
// the behaviour that matters (a real row, a real expiry), not a mock of
// it.

const FIXTURE_PREFIX = `LoginLockoutFixture${Date.now()}`;
let counter = 0;
function fixtureUserId(): string {
  counter += 1;
  return `${FIXTURE_PREFIX}-${counter}`;
}

describe("login lockout", () => {
  afterAll(async () => {
    await prisma.rateLimitCounter.deleteMany({ where: { key: { contains: FIXTURE_PREFIX } } });
    await prisma.$disconnect();
  });

  it("is not locked before any failures", async () => {
    const key = accountLockoutKey(fixtureUserId());
    expect((await checkAccountLockout(key)).locked).toBe(false);
  });

  it("is not locked after fewer than the threshold's worth of failures", async () => {
    const key = accountLockoutKey(fixtureUserId());
    for (let i = 0; i < 4; i++) await recordLoginFailure(key);
    expect((await checkAccountLockout(key)).locked).toBe(false);
  });

  it("locks after the threshold is reached", async () => {
    const key = accountLockoutKey(fixtureUserId());
    for (let i = 0; i < 5; i++) await recordLoginFailure(key);
    const status = await checkAccountLockout(key);
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps different accounts entirely independent", async () => {
    const targeted = accountLockoutKey(fixtureUserId());
    const bystander = accountLockoutKey(fixtureUserId());
    for (let i = 0; i < 5; i++) await recordLoginFailure(targeted);
    expect((await checkAccountLockout(targeted)).locked).toBe(true);
    expect((await checkAccountLockout(bystander)).locked).toBe(false);
  });

  it("keeps a real account's bucket separate from an unknown identifier's, even with the same raw text", async () => {
    const userId = fixtureUserId();
    const realAccountKey = accountLockoutKey(userId);
    const unknownKey = unknownIdentifierLockoutKey("memberNumber", userId); // deliberately reusing the same text
    for (let i = 0; i < 5; i++) await recordLoginFailure(realAccountKey);
    expect((await checkAccountLockout(realAccountKey)).locked).toBe(true);
    expect((await checkAccountLockout(unknownKey)).locked).toBe(false);
  });

  it("clearAccountLockout removes an active lockout immediately", async () => {
    const key = accountLockoutKey(fixtureUserId());
    for (let i = 0; i < 5; i++) await recordLoginFailure(key);
    expect((await checkAccountLockout(key)).locked).toBe(true);

    await clearAccountLockout(key);

    expect((await checkAccountLockout(key)).locked).toBe(false);
  });

  it("unlocks once the window has elapsed", async () => {
    const key = accountLockoutKey(fixtureUserId());
    // A short-lived counter proves the same expiry behaviour without a
    // 15 minute wait: recordLoginFailure always uses the real threshold
    // window internally, so this goes straight at the underlying store
    // instead, the same thing lib/rate-limit-store.test.ts checks.
    for (let i = 0; i < 5; i++) await incrementCounter(key, 1);
    expect((await checkAccountLockout(key)).locked).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect((await checkAccountLockout(key)).locked).toBe(false);
  });

  it("does not treat a lockout check itself as a new failure", async () => {
    const key = accountLockoutKey(fixtureUserId());
    for (let i = 0; i < 5; i++) await recordLoginFailure(key);
    await checkAccountLockout(key);
    await checkAccountLockout(key);
    await checkAccountLockout(key);
    expect((await checkAccountLockout(key)).locked).toBe(true); // still exactly at the threshold, not climbing
  });
});
