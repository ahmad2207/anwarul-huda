"use client";

import { useEffect, useRef, useState } from "react";
import type Human from "@vladmandic/human";
import type { Result } from "@vladmandic/human";
import {
  type HeadPoseReading,
  type LivenessChallenge,
  challengeSatisfied,
  pickRandomChallenge,
} from "@/lib/face/liveness-challenge";
import {
  UNCALIBRATED_DARKNESS_THRESHOLD,
  UNCALIBRATED_MIN_ANTISPOOF_SCORE,
  UNCALIBRATED_MIN_FACE_SCORE,
  UNCALIBRATED_MIN_LIVENESS_SCORE,
} from "@/lib/face/thresholds";
import { sampleBrightness } from "@/lib/face/sample-brightness";
import { checkInByFace } from "./actions";
import type { CheckInActionResult } from "./actions";

// SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md 3.1/3.5: the camera runs
// continuously alongside search, attempting one person after another,
// and never stops or shows a dead end on a miss, unlike enrolment's
// one-shot capture (app/account/face/face-capture.tsx). That difference
// in control flow is deliberate and is why this does not share
// face-capture.tsx's state machine, only the model, liveness and
// threshold modules underneath it.
const ATTEMPT_WINDOW_MS = 2500;
// A short pause after every attempt, match or not, so the same
// still-in-frame face is not immediately resubmitted before whoever it
// is has had a chance to step away.
const COOLDOWN_MS = 3000;

type Status = "loading" | "requesting-camera" | "scanning" | "checking" | "unavailable" | "offline";

// getUserMedia rejects with a DOMException whose name says which of
// several unrelated problems actually happened; distinguishing them is
// the difference between a message the officer can act on and "it did
// not work, try again."
function describeCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "This needs access to your camera, and it was not given. Check this browser's camera permission for this site and try again, or search by name below.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera could be found on this device. Search by name below.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera could not be started. It may be in use by another app or browser tab. Close it and try again, or search by name below.";
    default:
      return "Face check-in could not start on this device. Search by name below.";
  }
}

export function FaceCheckIn({
  gatheringId,
  onResult,
}: {
  gatheringId: string;
  onResult: (result: CheckInActionResult) => void;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  // Set at the end of an attempt window that never saw a bright-enough
  // frame: a real signal the officer can act on (find better light, check
  // the lens is not covered), rather than a black box with no explanation.
  const [dim, setDim] = useState(false);
  // Which of several distinct causes "unavailable" is: a permission
  // refusal, no camera at all, one already in use, an insecure origin, or
  // the models failing to load, all previously collapsed into one generic
  // message that gave the officer nothing to act on.
  const [unavailableReason, setUnavailableReason] = useState("");
  // Environment is only ever a preference (below): a device with no rear
  // camera falls back to a front one, and only that fallback case should
  // be mirrored, the same reason enrolment mirrors its always-front
  // camera. A genuine rear camera, aimed at whoever is arriving rather
  // than at the person holding the phone, must stay unmirrored, or the
  // scene itself would flip.
  const [mirror, setMirror] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const humanRef = useRef<Human | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cooldownUntilRef = useRef(0);

  // Face check-in needs the server for every attempt (3.5: "unavailable
  // offline"), so there is nothing to queue and nothing gained by
  // starting the camera at all while offline.
  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    let cancelled = false;

    async function loadModels() {
      try {
        const [{ default: HumanClass }, { HUMAN_CONFIG }] = await Promise.all([
          import("@vladmandic/human/dist/human.esm.js"),
          import("@/lib/face/human-config"),
        ]);
        if (cancelled) return;
        const human = new HumanClass(HUMAN_CONFIG);
        await human.load();
        if (cancelled) return;
        humanRef.current = human;
        setStatus("requesting-camera");
      } catch {
        if (!cancelled) {
          setUnavailableReason(
            "Something needed for this did not load, possibly a weak connection. Search by name below.",
          );
          setStatus("unavailable");
        }
      }
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "requesting-camera") return;
    let cancelled = false;

    async function requestCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        // The most common real cause: the page was opened over plain
        // http from something other than localhost. Browsers refuse
        // camera access entirely on an insecure origin, with no
        // permission prompt and no exception to catch below, just this
        // API being absent.
        setUnavailableReason(
          "This page needs a secure (https) connection to use the camera. Search by name below.",
        );
        setStatus("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // A preference, not a requirement: the officer's phone has a
          // rear camera to prefer, but a desktop or laptop testing this
          // usually has only one, front-facing, camera. { ideal } falls
          // back to whatever exists instead of failing outright the way
          // a bare "environment" value can on some browsers.
          // 4:5, matched to the preview box below: a camera that can
          // deliver this natively is shown edge to edge, with no crop
          // needed to fit either dimension.
          video: { facingMode: { ideal: "environment" }, width: { ideal: 480 }, height: { ideal: 600 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setMirror(stream.getVideoTracks()[0]?.getSettings().facingMode === "user");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("scanning");
      } catch (error) {
        if (cancelled) return;
        setUnavailableReason(describeCameraError(error));
        setStatus("unavailable");
      }
    }

    void requestCamera();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Released whenever this screen goes away, not only on an explicit
  // stop: an officer navigating off never leaves the camera running.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Mid-session connectivity changes: face check-in stops offering
  // itself the moment the connection drops, and picks back up if it
  // returns. Search next to this is unaffected either way.
  useEffect(() => {
    function goOffline() {
      setStatus("offline");
    }
    function comeOnline() {
      setStatus((current) => (current === "offline" ? "requesting-camera" : current));
    }
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", comeOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", comeOnline);
    };
  }, []);

  useEffect(() => {
    if (status !== "scanning") return;
    let stopped = false;
    let attemptStartedAt = performance.now();
    let currentChallenge = pickRandomChallenge();
    setChallenge(currentChallenge);
    setDim(false);
    const readings: HeadPoseReading[] = [];
    let best: { embedding: number[]; live: number; score: number } | null = null;
    let sawBrightFrame = false;

    async function tick() {
      if (stopped) return;
      const human = humanRef.current;
      const video = videoRef.current;

      if (!human || !video || Date.now() < cooldownUntilRef.current) {
        requestAnimationFrame(() => void tick());
        return;
      }

      // Same scratch-canvas sampling face-capture.tsx uses to decide
      // whether its one-shot capture failed for want of light: here it
      // is a per-attempt-window signal instead, since this loop never
      // stops to report a single failure.
      if (sampleBrightness(video) >= UNCALIBRATED_DARKNESS_THRESHOLD) sawBrightFrame = true;

      const result: Result = await human.detect(video);
      const face = result.face[0];
      // Nothing below outlives this tick beyond a yaw/pitch angle pair
      // and, for a frame that also passes both liveness gates, an 1024
      // number embedding and its score: the same discard point
      // face-capture.tsx documents, reused rather than re-proven here.

      if (face && face.score >= UNCALIBRATED_MIN_FACE_SCORE && face.embedding && face.rotation) {
        readings.push({ yaw: face.rotation.angle.yaw, pitch: face.rotation.angle.pitch });
        if (
          (face.live ?? 0) >= UNCALIBRATED_MIN_LIVENESS_SCORE &&
          (face.real ?? 0) >= UNCALIBRATED_MIN_ANTISPOOF_SCORE &&
          (!best || face.score > best.score)
        ) {
          best = { embedding: face.embedding, live: face.live ?? 0, score: face.score };
        }
      }

      if (performance.now() - attemptStartedAt >= ATTEMPT_WINDOW_MS) {
        if (best && challengeSatisfied(currentChallenge.id, readings)) {
          const toSubmit = best;
          void submit(toSubmit.embedding, toSubmit.live);
        }
        setDim(!sawBrightFrame);
        // Reset for the next attempt regardless of outcome: a miss, a
        // no-match, and an unsatisfied challenge are all the same
        // "try again" case here, never a dead end (3.5).
        attemptStartedAt = performance.now();
        currentChallenge = pickRandomChallenge();
        setChallenge(currentChallenge);
        readings.length = 0;
        best = null;
        sawBrightFrame = false;
      }

      requestAnimationFrame(() => void tick());
    }

    async function submit(embedding: number[], livenessScore: number) {
      cooldownUntilRef.current = Date.now() + ATTEMPT_WINDOW_MS + COOLDOWN_MS;
      setStatus("checking");
      try {
        const result = await checkInByFace(gatheringId, embedding, livenessScore);
        onResult(result);
      } catch {
        // No offline path for a face check-in (3.5): a genuine network
        // failure here is silently retried on the next attempt, not
        // queued. Manual search is what still works while this does not.
      } finally {
        setStatus("scanning");
      }
    }

    requestAnimationFrame(() => void tick());
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onResult is expected to be stable from the caller; re-running this effect on every render identity change would restart the camera loop for no reason.
  }, [status, gatheringId]);

  if (status === "offline") {
    return (
      <p className="rounded-md bg-white/10 px-3 py-2 text-sm text-white/80">
        Face check-in needs a connection and is not available right now. Search by name below still works.
      </p>
    );
  }

  if (status === "unavailable") {
    return <p className="rounded-md bg-white/10 px-3 py-2 text-sm text-white/80">{unavailableReason}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-md border border-white/20">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`aspect-[4/5] w-full bg-black object-cover ${mirror ? "-scale-x-100" : ""}`}
        />
        {status === "loading" || status === "requesting-camera" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
            {status === "loading" ? "Getting ready…" : "Requesting camera…"}
          </div>
        ) : null}
      </div>
      <p className="text-center text-sm text-white/60">
        {status === "checking"
          ? "Checking…"
          : dim
            ? "It's too dark to see clearly. Move somewhere brighter."
            : (challenge?.instruction ?? "Looking for a face…")}
      </p>
    </div>
  );
}
