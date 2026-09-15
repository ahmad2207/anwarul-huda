import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimitForTests } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitForTests();
    vi.useRealTimers();
  });

  it("allows calls up to the limit within the window", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("key-a", 5, 60).allowed).toBe(true);
    }
  });

  it("refuses the call once the limit is reached within the window", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("key-b", 5, 60);
    }
    const result = checkRateLimit("key-b", 5, 60);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps different keys entirely independent", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("key-c", 5, 60);
    }
    expect(checkRateLimit("key-c", 5, 60).allowed).toBe(false);
    expect(checkRateLimit("key-d", 5, 60).allowed).toBe(true); // a different key, untouched
  });

  it("allows calls again once the window has elapsed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    for (let i = 0; i < 3; i++) {
      checkRateLimit("key-e", 3, 10);
    }
    expect(checkRateLimit("key-e", 3, 10).allowed).toBe(false);

    vi.setSystemTime(11_000); // 11 seconds later, past the 10 second window
    expect(checkRateLimit("key-e", 3, 10).allowed).toBe(true);

    vi.useRealTimers();
  });
});
