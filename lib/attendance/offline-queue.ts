// Pure queue management for the offline check-in design (see the
// conversation this was designed in, and app/admin/attendance/[id]/
// check-in-client.tsx for where it is actually wired up to localStorage
// and the network). Kept framework and storage independent, so it can be
// unit tested against a fake in-memory store instead of a real browser.

export interface QueuedCheckIn {
  tempId: string;
  memberId: string;
  memberName: string;
  memberNumber: string | null;
  method: "MANUAL" | "QR_CODE";
  queuedAt: string;
}

export interface QueueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function queueStorageKey(gatheringId: string): string {
  return `ahl-attendance-queue:${gatheringId}`;
}

export function loadQueue(storage: QueueStorage, gatheringId: string): QueuedCheckIn[] {
  const raw = storage.getItem(queueStorageKey(gatheringId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedCheckIn[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(storage: QueueStorage, gatheringId: string, queue: QueuedCheckIn[]): void {
  storage.setItem(queueStorageKey(gatheringId), JSON.stringify(queue));
}

/** Adds an entry, unless that member is already queued for this gathering (an officer tapping twice while offline should not queue the same check-in twice). */
export function enqueue(
  storage: QueueStorage,
  gatheringId: string,
  entry: QueuedCheckIn,
): QueuedCheckIn[] {
  const queue = loadQueue(storage, gatheringId);
  if (queue.some((existing) => existing.memberId === entry.memberId)) {
    return queue;
  }
  const next = [...queue, entry];
  saveQueue(storage, gatheringId, next);
  return next;
}

export function dequeue(storage: QueueStorage, gatheringId: string, tempId: string): QueuedCheckIn[] {
  const queue = loadQueue(storage, gatheringId);
  const next = queue.filter((entry) => entry.tempId !== tempId);
  saveQueue(storage, gatheringId, next);
  return next;
}

/**
 * Whether a caught error looks like a network failure (the Server Action
 * could not even reach the server) rather than a normal response the
 * action chose to return. A dead fetch throws a TypeError in every
 * browser this needs to support; matched loosely on message too, since
 * Next's own client runtime sometimes wraps the underlying fetch error.
 * Deliberately conservative: anything not recognised as a network error
 * is treated as a real rejection, surfaced immediately rather than
 * silently queued and retried forever.
 */
export function isLikelyNetworkError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if (error instanceof TypeError) return true;
  const message = "message" in error ? String((error as { message: unknown }).message).toLowerCase() : "";
  return message.includes("fetch") || message.includes("network") || message.includes("load failed");
}
