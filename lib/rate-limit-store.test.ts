import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cleanupExpiredCounters, deleteCounter, getCounter, incrementCounter } from "./rate-limit-store";

const FIXTURE_PREFIX = `RateLimitStoreFixture${Date.now()}`;
let counter = 0;
function fixtureKey(): string {
  counter += 1;
  return `${FIXTURE_PREFIX}:${counter}`;
}

describe("rate-limit-store", () => {
  afterAll(async () => {
    await prisma.rateLimitCounter.deleteMany({ where: { key: { startsWith: FIXTURE_PREFIX } } });
    await prisma.$disconnect();
  });

  it("starts a new counter at 1", async () => {
    const key = fixtureKey();
    const result = await incrementCounter(key, 60);
    expect(result.count).toBe(1);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("increments an existing counter within its window", async () => {
    const key = fixtureKey();
    await incrementCounter(key, 60);
    const second = await incrementCounter(key, 60);
    expect(second.count).toBe(2);
  });

  it("resets to 1 once the window has expired, rather than continuing to climb", async () => {
    const key = fixtureKey();
    await incrementCounter(key, 1);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // generous margin over the DB round trip
    const afterExpiry = await incrementCounter(key, 60);
    expect(afterExpiry.count).toBe(1);
  });

  it("getCounter reads without incrementing", async () => {
    const key = fixtureKey();
    await incrementCounter(key, 60);
    await incrementCounter(key, 60);
    const read1 = await getCounter(key);
    const read2 = await getCounter(key);
    expect(read1?.count).toBe(2);
    expect(read2?.count).toBe(2); // unchanged by reading it
  });

  it("getCounter returns null for a key that was never touched", async () => {
    expect(await getCounter(fixtureKey())).toBeNull();
  });

  it("getCounter returns null once the window has expired, even though the row still exists", async () => {
    const key = fixtureKey();
    await incrementCounter(key, 1);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // generous margin over the DB round trip
    expect(await getCounter(key)).toBeNull();
  });

  it("deleteCounter removes the row so the next increment starts fresh", async () => {
    const key = fixtureKey();
    await incrementCounter(key, 60);
    await incrementCounter(key, 60);
    await deleteCounter(key);
    const result = await incrementCounter(key, 60);
    expect(result.count).toBe(1);
  });

  it("cleanupExpiredCounters removes only expired rows, leaving live ones alone", async () => {
    const expiredKey = fixtureKey();
    const liveKey = fixtureKey();
    await incrementCounter(expiredKey, 1);
    await incrementCounter(liveKey, 3600);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // generous margin over the DB round trip

    await cleanupExpiredCounters();

    const expiredRow = await prisma.rateLimitCounter.findUnique({ where: { key: expiredKey } });
    const liveRow = await prisma.rateLimitCounter.findUnique({ where: { key: liveKey } });
    expect(expiredRow).toBeNull();
    expect(liveRow).not.toBeNull();
  });
});
