"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusTag } from "@/components/status-tag";
import { checkInAction, checkInByMemberNumber, loadCheckInRoster, undoCheckIn } from "./actions";
import type { CheckInActionResult, RosterMember } from "./actions";
import { FaceCheckIn } from "./face-check-in";
import { dequeue, enqueue, isLikelyNetworkError, loadQueue } from "@/lib/attendance/offline-queue";
import type { QueuedCheckIn } from "@/lib/attendance/offline-queue";
import { formatMemberName } from "@/lib/members/display-name";

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
const BANNER_DURATION_MS = 2500;

export function CheckInClient({
  gatheringId,
  gatheringTitle,
  wingName,
  initialCount,
  isClosed,
}: {
  gatheringId: string;
  gatheringTitle: string;
  wingName: string;
  initialCount: number;
  isClosed: boolean;
}) {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [count, setCount] = useState(initialCount);
  const [pendingCount, setPendingCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  // A prominent, self-dismissing confirmation for every successful
  // check-in, face or manual: the running count and Recent list below
  // already record it, but neither is loud enough for an officer whose
  // attention is on the camera, or a member glancing up after search
  // finds their own name. bannerId, not just the text, keys the banner
  // element, so two check-ins in a row for the same person (a duplicate
  // scan) restart the timeout and the on-screen dwell instead of the
  // second one being a no-op update to already-displayed text.
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const bannerIdRef = useRef(0);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  // Every check-in, face included, leaves this gathering's screen for
  // the gatherings list once the confirmation has had time to be seen.
  // Confirmed with the office despite what it costs face check-in
  // specifically: the camera's continuous scanning (3.5, "never a dead
  // end") only ever covers one arrival before the officer has to reopen
  // this gathering for the next.
  function showBanner(text: string) {
    bannerIdRef.current += 1;
    setBanner({ id: bannerIdRef.current, text });
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => router.push("/admin/attendance"), BANNER_DURATION_MS);
  }

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
          setMessage("Something went wrong while syncing pending check-ins. They are still queued to try again.");
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
              (member.surname ?? "").toLowerCase().includes(q) ||
              (member.firstName ?? "").toLowerCase().includes(q) ||
              (member.fullNameAsWritten ?? "").toLowerCase().includes(q) ||
              (member.memberNumber ?? "").toLowerCase().includes(q)
            );
          })
          .slice(0, 10);

  function markRosterCheckedIn(memberId: string) {
    setRoster((current) => current.map((m) => (m.id === memberId ? { ...m, alreadyCheckedIn: true } : m)));
  }

  async function performCheckIn(member: { id: string; memberNumber: string | null }) {
    setMessage(null);
    try {
      const result = await checkInAction(gatheringId, member.id, "MANUAL");

      if (result.error) {
        setMessage(result.error);
        return;
      }
      applySuccess(result, "synced", null);
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        setMessage("Something went wrong recording this check-in. Try again.");
        return;
      }
      queueOffline(member, "MANUAL");
    }
  }

  function queueOffline(member: { id: string; memberNumber: string | null }, method: "MANUAL" | "QR_CODE") {
    const rosterEntry = roster.find((m) => m.id === member.id);
    const tempId = `pending-${member.id}-${Date.now()}`;
    const queued: QueuedCheckIn = {
      tempId,
      memberId: member.id,
      memberName: rosterEntry ? formatMemberName(rosterEntry) : member.memberNumber ?? "Unknown",
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

    showBanner(
      result.alreadyCheckedIn ? `${result.memberName} was already checked in` : `${result.memberName} checked in`,
    );

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

  // A face match already carries the same shape performCheckIn's server
  // actions return, and it has no offline path to fall back to (3.5), so
  // it goes straight to applySuccess rather than through performCheckIn.
  // A miss stays silent: no message, camera keeps running, search stays
  // available exactly as it already was.
  function handleFaceResult(result: CheckInActionResult) {
    if (!result.memberId || !result.memberName) return;
    applySuccess(result, "synced", null);
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

  // Full bleed navy-900 (DESIGN.md section 4.3): its own surface, not
  // another page inside the admin shell. AdminShell (components/
  // admin-shell.tsx) already knows to leave the sidebar off this route;
  // everything below is what fills the space that leaves.
  if (isClosed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 p-6 text-center">
        <p className="text-lg text-white">This gathering is closed. No further check-ins are accepted.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white" style={{ fontSize: "20px" }}>
      {banner ? (
        <p
          key={banner.id}
          role="status"
          className="fixed top-4 left-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 rounded-md bg-emerald-600 px-6 py-3 text-center text-lg font-semibold text-white shadow-lg"
        >
          ✓ {banner.text}
        </p>
      ) : null}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static asset, not one next/image needs to optimise */}
            <img src="/logo.png" alt="" width={40} height={40} className="shrink-0" />
            <div>
              <h1 className="font-heading text-xl font-bold">{gatheringTitle}</h1>
              <p className="text-sm text-white/70">{wingName}</p>
            </div>
          </div>
          {/* Permanently visible whenever there is anything to report, never
              a toast that could be missed or dismissed: the one place
              amber-500 appears outside the running count itself. */}
          {pendingCount > 0 ? (
            <p className="text-base font-medium text-amber-500">{pendingCount} waiting to sync</p>
          ) : null}
        </div>

        <FaceCheckIn gatheringId={gatheringId} onResult={handleFaceResult} />

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or member number"
          className="h-16 rounded-md border-0 bg-white px-4 text-lg text-ink placeholder:text-ink-2"
          autoFocus
        />

        {message ? <p className="text-base font-medium text-amber-500">{message}</p> : null}

        <div className="flex flex-col gap-2">
          {results.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => void performCheckIn(member)}
              className="flex min-h-16 items-center justify-between rounded-md bg-white px-4 py-3 text-left text-ink hover:bg-white/90"
            >
              <span>
                <span className="font-medium">{formatMemberName(member)}</span>{" "}
                <span className="text-base text-ink-2">
                  {member.memberNumber ?? "Not yet issued"} &middot; {member.wingName}
                </span>
              </span>
              {member.alreadyCheckedIn ? (
                <StatusTag tone="confirmed">Checked in</StatusTag>
              ) : (
                <span className="text-base font-medium text-navy-700">Tap to check in</span>
              )}
            </button>
          ))}
        </div>

        {/* The largest element on the screen (DESIGN.md section 4.3): what
            an officer glances at, and what they will be asked for. A real
            radial glow, the same light the logo's own lantern holds, not
            just a number set in an accent colour. The glow pulses slowly;
            motion-reduce turns that off, everything else here is static. */}
        <div className="relative flex flex-col items-center gap-1 py-6">
          <div
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/30 blur-3xl motion-safe:animate-pulse"
          />
          <p
            data-testid="checked-in-count"
            className="font-heading relative text-8xl leading-none font-bold text-amber-500 [text-shadow:0_0_60px_rgba(255,151,0,0.55)]"
          >
            {count}
          </p>
          <p className="relative font-heading text-lg text-white/70">checked in</p>
        </div>

        {recent.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-md bg-white/10 p-3">
            <p className="text-sm font-medium tracking-wide text-white/60 uppercase">Recent</p>
            {recent.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-ink"
              >
                <span className="text-base">
                  {entry.memberName}
                  {entry.alreadyCheckedIn ? (
                    <span className="ml-1 text-sm text-ink-2">(already checked in)</span>
                  ) : entry.status === "pending" ? (
                    <span className="ml-1">
                      <StatusTag tone="attention">Pending sync</StatusTag>
                    </span>
                  ) : (
                    <span className="ml-1">
                      <StatusTag tone="confirmed">Synced</StatusTag>
                    </span>
                  )}
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => handleUndo(entry)}>
                  Undo
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
