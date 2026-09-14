import { describe, expect, it } from "vitest";
import {
  dequeue,
  enqueue,
  isLikelyNetworkError,
  loadQueue,
  queueStorageKey,
} from "./offline-queue";
import type { QueuedCheckIn, QueueStorage } from "./offline-queue";

function fakeStorage(): QueueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function entry(overrides: Partial<QueuedCheckIn> = {}): QueuedCheckIn {
  return {
    tempId: "temp-1",
    memberId: "member-1",
    memberName: "Bello Amina",
    memberNumber: "AHL/W/2026/0001",
    method: "MANUAL",
    queuedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("offline queue", () => {
  it("starts empty for a gathering with nothing queued", () => {
    expect(loadQueue(fakeStorage(), "gathering-1")).toEqual([]);
  });

  it("adds an entry and persists it under a key scoped to the gathering", () => {
    const storage = fakeStorage();
    enqueue(storage, "gathering-1", entry());
    expect(loadQueue(storage, "gathering-1")).toHaveLength(1);
    expect(storage.getItem(queueStorageKey("gathering-1"))).not.toBeNull();
  });

  it("keeps different gatherings' queues independent", () => {
    const storage = fakeStorage();
    enqueue(storage, "gathering-1", entry());
    expect(loadQueue(storage, "gathering-2")).toEqual([]);
  });

  it("does not queue the same member twice while already pending", () => {
    const storage = fakeStorage();
    enqueue(storage, "gathering-1", entry({ tempId: "a" }));
    enqueue(storage, "gathering-1", entry({ tempId: "b" })); // same memberId
    expect(loadQueue(storage, "gathering-1")).toHaveLength(1);
  });

  it("removes an entry by tempId on dequeue", () => {
    const storage = fakeStorage();
    enqueue(storage, "gathering-1", entry({ tempId: "a", memberId: "m1" }));
    enqueue(storage, "gathering-1", entry({ tempId: "b", memberId: "m2" }));

    dequeue(storage, "gathering-1", "a");

    const remaining = loadQueue(storage, "gathering-1");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].tempId).toBe("b");
  });

  it("returns an empty queue rather than throwing on corrupted stored data", () => {
    const storage = fakeStorage();
    storage.setItem(queueStorageKey("gathering-1"), "not valid json");
    expect(loadQueue(storage, "gathering-1")).toEqual([]);
  });
});

describe("isLikelyNetworkError", () => {
  it("recognises a TypeError, what a dead fetch throws", () => {
    expect(isLikelyNetworkError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("recognises an error whose message mentions fetch or network", () => {
    expect(isLikelyNetworkError(new Error("NetworkError when attempting to fetch resource"))).toBe(true);
    expect(isLikelyNetworkError(new Error("Load failed"))).toBe(true);
  });

  it("does not treat a plain validation-style error as a network error", () => {
    expect(isLikelyNetworkError(new Error("This gathering is closed."))).toBe(false);
  });

  it("does not treat a non-error value as a network error", () => {
    expect(isLikelyNetworkError("just a string")).toBe(false);
    expect(isLikelyNetworkError(null)).toBe(false);
    expect(isLikelyNetworkError(undefined)).toBe(false);
  });
});
