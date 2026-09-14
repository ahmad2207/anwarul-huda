"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkInAction, checkInByMemberNumber, loadCheckInRoster, undoCheckIn } from "./actions";
import type { RosterMember } from "./actions";
import { QrScanner } from "./qr-scanner";
import { dequeue, enqueue, isLikelyNetworkError, loadQueue } from "@/lib/attendance/offline-queue";
import type { QueuedCheckIn } from "@/lib/attendance/offline-queue";

interface RecentEntry {
  key: string;
  memberId: string;
  memberName: string;
  memberNumber: string | null;
  alreadyCheckedIn: boolean;
  status: "synced" | "pending";
  recordId: string | null;
  tempId: string | null;
}

const MAX_RECENT_ENTRIES = 5;
const SYNC_RETRY_INTERVAL_MS = 5000;

export function CheckInClient({
  gatheringId,
  initialCount,
  isClosed,
}: {
  gatheringId: string;
  initialCount: number;
  isClosed: boolean;
}) {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [count, setCount] = useState(initialCount);
  const [pendingCount, setPendingCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const syncingRef = useRef(false);

  // The roster is loaded once, while the page still has a connection
  // (it was just server rendered, so it does). After that, search and QR
  // resolution both work entirely against this cached copy, so losing
  // the connection mid-session never blocks finding who to check in,
  // only the final submission, which the queue below covers.
  useEffect(() => {
    loadCheckInRoster(gatheringId)
      .then(setRoster)
      .catch(() => {
        // Nothing cached yet and the very first load failed: search will
        // come up empty until this succeeds. Nothing to queue here, there
        // is no check-in to lose, just retry silently on next mount.
      });
  }, [gatheringId]);

  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      let queue = loadQueue(window.localStorage, gatheringId);
      for (const item of queue) {
        try {
          const result = item.memberId
            ? await checkInAction(gatheringId, item.memberId, item.method)
            : await checkInByMemberNumber(gatheringId, item.memberNumber ?? "");

          if (result.error) {
            setMessage(`Could not sync check-in for ${item.memberName}: ${result.error}`);
            break; // a real rejection, not a connectivity problem: stop and let the officer see it
          }

          queue = dequeue(window.localStorage, gatheringId, item.tempId);
          setPendingCount(queue.length);
          setRecent((current) =>
            current.map((entry) =>
              entry.tempId === item.tempId
                ? { ...entry, status: "synced", recordId: result.recordId ?? null, tempId: null }
                : entry,
            ),
          );
        } catch (error) {
          if (isLikelyNetworkError(error)) {
            break; // still offline: stop this pass, the interval or the online event will try again
          }
          setMessage("Something went wrong while syncing pending check-ins.");
          break;
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, [gatheringId]);

  // Pick up anything left over from a previous offline session, retry on
  // the browser's own online signal, and fall back to a periodic retry
  // regardless, because navigator.onLine / the online event are known to
  // be unreliable indicators of real connectivity in some browsers: this
  // never depends on them being right, only uses them to try sooner.
  useEffect(() => {
    setPendingCount(loadQueue(window.localStorage, gatheringId).length);
    void syncQueue();

    window.addEventListener("online", syncQueue);
    const interval = setInterval(syncQueue, SYNC_RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", syncQueue);
      clearInterval(interval);
    };
  }, [gatheringId, syncQueue]);

  const results =
    query.trim().length < 2
      ? []
      : roster
          .filter((member) => {
            const q = query.trim().toLowerCase();
            return (
              member.surname.toLowerCase().includes(q) ||
              member.firstName.toLowerCase().includes(q) ||
              (member.memberNumber ?? "").toLowerCase().includes(q)
            );
          })
          .slice(0, 10);

  function markRosterCheckedIn(memberId: string) {
    setRoster((current) => current.map((m) => (m.id === memberId ? { ...m, alreadyCheckedIn: true } : m)));
  }

  async function performCheckIn(member: { id: string; memberNumber: string | null }, method: "MANUAL" | "QR_CODE") {
    setMessage(null);
    try {
      const result =
        method === "QR_CODE" && !roster.some((m) => m.id === member.id)
          ? await checkInByMemberNumber(gatheringId, member.memberNumber ?? "")
          : await checkInAction(gatheringId, member.id, method);

      if (result.error) {
        setMessage(result.error);
        return;
      }
      applySuccess(result, "synced", null);
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        setMessage("Something went wrong recording this check-in.");
        return;
      }
      queueOffline(member, method);
    }
  }

  function queueOffline(member: { id: string; memberNumber: string | null }, method: "MANUAL" | "QR_CODE") {
    const rosterEntry = roster.find((m) => m.id === member.id);
    const tempId = `pending-${member.id}-${Date.now()}`;
    const queued: QueuedCheckIn = {
      tempId,
      memberId: member.id,
      memberName: rosterEntry ? `${rosterEntry.surname} ${rosterEntry.firstName}` : member.memberNumber ?? "Unknown",
      memberNumber: rosterEntry?.memberNumber ?? member.memberNumber ?? null,
      method,
      queuedAt: new Date().toISOString(),
    };
    const nextQueue = enqueue(window.localStorage, gatheringId, queued);
    setPendingCount(nextQueue.length);

    applySuccess(
      {
        memberId: queued.memberId,
        memberName: queued.memberName,
        memberNumber: queued.memberNumber,
        alreadyCheckedIn: false,
      },
      "pending",
      tempId,
    );
  }

  function applySuccess(
    result: { memberId?: string; memberName?: string; memberNumber?: string | null; alreadyCheckedIn?: boolean; recordId?: string },
    status: "synced" | "pending",
    tempId: string | null,
  ) {
    if (!result.alreadyCheckedIn) {
      setCount((c) => c + 1);
    }
    if (result.memberId) markRosterCheckedIn(result.memberId);

    setRecent((current) =>
      [
        {
          key: tempId ?? result.recordId ?? `${result.memberId}-${Date.now()}`,
          memberId: result.memberId!,
          memberName: result.memberName!,
          memberNumber: result.memberNumber ?? null,
          alreadyCheckedIn: result.alreadyCheckedIn ?? false,
          status,
          recordId: result.recordId ?? null,
          tempId,
        },
        ...current,
      ].slice(0, MAX_RECENT_ENTRIES),
    );
    setQuery("");
  }

  function handleQrScan(scannedMemberNumber: string) {
    const match = roster.find((m) => m.memberNumber === scannedMemberNumber);
    if (!match) {
      // Not in the cached roster (rare: a very new member, or the roster
      // has not loaded yet). Try the server directly rather than failing
      // outright; if that also fails for lack of connection, there is
      // nothing safe to queue, since which member this is has never been
      // confirmed.
      void checkInByMemberNumber(gatheringId, scannedMemberNumber).then((result) => {
        if (result.error) {
          setMessage(result.error);
          return;
        }
        applySuccess(result, "synced", null);
      });
      return;
    }
    void performCheckIn(match, "QR_CODE");
  }

  function handleUndo(entry: RecentEntry) {
    setRecent((current) => current.filter((e) => e.key !== entry.key));
    setCount((c) => Math.max(0, c - 1));

    if (entry.status === "pending" && entry.tempId) {
      const nextQueue = dequeue(window.localStorage, gatheringId, entry.tempId);
      setPendingCount(nextQueue.length);
      return;
    }

    if (entry.recordId) {
      void undoCheckIn(gatheringId, entry.recordId).catch((err) => {
        setMessage(err instanceof Error ? err.message : "Could not undo this check-in.");
      });
    }
  }

  if (isClosed) {
    return (
      <p className="rounded-md border p-3 text-sm text-muted-foreground">
        This gathering is closed. No further check-ins are accepted.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-2xl font-semibold">{count}</p>
        <div className="text-right text-sm text-muted-foreground">
          <p>checked in</p>
          {pendingCount > 0 ? (
            <p className="font-medium text-amber-700 dark:text-amber-400">{pendingCount} pending sync</p>
          ) : null}
        </div>
      </div>

      <QrScanner onScan={handleQrScan} />

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name or member number"
        className="h-12 text-base"
        autoFocus
      />

      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <div className="flex flex-col gap-2">
        {results.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => void performCheckIn(member, "MANUAL")}
            className="flex items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted"
          >
            <span>
              <span className="font-medium">
                {member.surname} {member.firstName}
              </span>{" "}
              <span className="text-muted-foreground">
                {member.memberNumber ?? "Not yet issued"} &middot; {member.wingName}
              </span>
            </span>
            {member.alreadyCheckedIn ? (
              <span className="text-xs text-muted-foreground">Checked in</span>
            ) : (
              <span className="text-xs font-medium">Tap to check in</span>
            )}
          </button>
        ))}
      </div>

      {recent.length > 0 ? (
        <div className="flex flex-col gap-1 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Recent</p>
          {recent.map((entry) => (
            <div key={entry.key} className="flex items-center justify-between text-sm">
              <span>
                {entry.memberName}
                {entry.alreadyCheckedIn ? (
                  <span className="ml-1 text-xs text-muted-foreground">(already checked in)</span>
                ) : entry.status === "pending" ? (
                  <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">(pending sync)</span>
                ) : null}
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => handleUndo(entry)}>
                Undo
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
