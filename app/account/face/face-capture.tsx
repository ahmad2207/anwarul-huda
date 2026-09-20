"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type Human from "@vladmandic/human";
import type { Result } from "@vladmandic/human";
import { Button } from "@/components/ui/button";
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
import { saveFaceEnrolment } from "./actions";

// SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md 3.4: a randomly chosen action,
// held for this long to give a real, deliberate movement time to show
// up in the captured readings.
const CAPTURE_WINDOW_MS = 4000;

type Phase =
  | "loading-models"
  | "requesting-camera"
  | "ready"
  | "capturing"
  | "processing"
  | "saving"
  | "enrolled"
  | "permission-denied"
  | "no-camera"
  | "models-failed"
  | "too-dark"
  | "no-face-detected"
  | "liveness-not-satisfied"
  | "save-failed";

// Every failure phase reads a message off this table and every one
// offers the same way out (SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md B1 #6: "a
// member must never be trapped on this screen"), never a dead end.
const FAILURE_MESSAGES: Partial<Record<Phase, string>> = {
  "permission-denied":
    "This needs access to your camera, and it was not given. Check your phone's settings and try again, or leave it to the office.",
  "no-camera": "No camera could be found on this device. Leave it to the office and they will help you in person.",
  "models-failed":
    "Something needed for this did not load, possibly a weak connection. Try again somewhere with a better signal, or leave it to the office.",
  "too-dark": "It's too dark to see your face clearly. Move somewhere brighter and try again.",
  "no-face-detected": "Your face was not clearly seen. Hold the phone at eye level, with your whole face in view.",
  "liveness-not-satisfied":
    "That could not be confirmed as a live movement. Make sure you are the one in front of the camera, in good light, and try again.",
  "save-failed": "That could not be saved. Check your connection and try again, or leave it to the office.",
};

export function FaceCapture() {
  const [phase, setPhase] = useState<Phase>("loading-models");
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const humanRef = useRef<Human | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // A callback ref, not a plain one: the video element only mounts once
  // phase reaches "ready", but the camera stream is requested and
  // resolved while still on "requesting-camera", a phase with no video
  // element in its tree at all. A plain ref read at that moment is
  // always null, so the stream obtained then was never attached to the
  // element that eventually appeared. This attaches it the instant the
  // node actually exists, whichever phase that happens to be.
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
      void node.play();
    }
  }, []);

  // Loaded once, lazily, on this route only (SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md
  // 3.3). ~8.2MB across the library and its four models (see the
  // conversation for the measured breakdown): every other route in the
  // app never imports this module, so nothing else pays for it.
  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        const [{ default: HumanClass }, { HUMAN_CONFIG }] = await Promise.all([
          // The explicit /dist/human.esm.js subpath, not the bare
          // package specifier: the package's own exports map offers a
          // node build first for a plain `import("@vladmandic/human")`,
          // which Next.js's server side webpack pass picks up even
          // though this only ever runs in the browser, and then fails
          // to bundle at all (it wants @tensorflow/tfjs-node, a
          // dependency this project never installs). The explicit
          // browser ESM bundle this subpath names is unambiguous.
          // (lib/face/human-esm.d.ts declares its type, which the
          // package itself only does for the top level specifier.)
          import("@vladmandic/human/dist/human.esm.js"),
          import("@/lib/face/human-config"),
        ]);
        if (cancelled) return;
        const human = new HumanClass(HUMAN_CONFIG);
        await human.load();
        if (cancelled) return;
        humanRef.current = human;
        setPhase("requesting-camera");
      } catch {
        if (!cancelled) setPhase("models-failed");
      }
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  // Camera permission, requested only once the models are ready so a
  // member is not asked for it and then left waiting on a download.
  useEffect(() => {
    if (phase !== "requesting-camera") return;
    let cancelled = false;

    async function requestCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // { ideal }, not a hard requirement: a device with no
          // front-facing camera (or that does not label one) should
          // still get whatever camera it has, not an OverconstrainedError.
          // 4:5, matched to the preview box below.
          video: { facingMode: { ideal: "user" }, width: { ideal: 480 }, height: { ideal: 600 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        // Not attached here: the video element for "ready" has not
        // mounted yet at this point. attachVideo's callback ref does it
        // the instant it does.
        streamRef.current = stream;
        setPhase("ready");
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotFoundError" || name === "OverconstrainedError") {
          setPhase("no-camera");
        } else {
          setPhase("permission-denied");
        }
      }
    }

    void requestCamera();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  // Camera stream and video element are released whenever this
  // component leaves the page, not only on success: a member who backs
  // out mid capture does not leave the camera running.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function startCapture() {
    const human = humanRef.current;
    const video = videoRef.current;
    if (!human || !video) return;

    const pickedChallenge = pickRandomChallenge();
    setChallenge(pickedChallenge);
    setPhase("capturing");

    const readings: HeadPoseReading[] = [];
    const passingFrames: Array<{ embedding: number[]; score: number; live: number }> = [];
    let sawAnyFace = false;
    let sawBrightFrame = false;
    let livenessOk = false;
    const startedAt = performance.now();

    async function tick() {
      const activeHuman = humanRef.current;
      const activeVideo = videoRef.current;
      if (!activeHuman || !activeVideo) return;

      // A brightness reading, taken from a tiny scratch canvas that is
      // overwritten every tick and never saved, addressed or read from
      // again once this function returns: sampling it is not the same
      // as retaining a frame.
      const brightness = sampleBrightness(activeVideo);
      if (brightness >= UNCALIBRATED_DARKNESS_THRESHOLD) sawBrightFrame = true;

      const result: Result = await activeHuman.detect(activeVideo);
      const face = result.face[0];

      if (face && face.score >= UNCALIBRATED_MIN_FACE_SCORE && face.embedding && face.rotation) {
        sawAnyFace = true;
        readings.push({ yaw: face.rotation.angle.yaw, pitch: face.rotation.angle.pitch });
        if ((face.live ?? 0) >= UNCALIBRATED_MIN_LIVENESS_SCORE && (face.real ?? 0) >= UNCALIBRATED_MIN_ANTISPOOF_SCORE) {
          livenessOk = true;
          passingFrames.push({ embedding: face.embedding, score: face.score, live: face.live ?? 0 });
        }
      }
      // `result`, `face` and the video frame they describe are not
      // referenced again after this point: nothing above stores a
      // pixel, a canvas, a data URL or the `tensor` field
      // FaceResult can carry (detector.return is false in
      // lib/face/human-config.ts, so it never has one to begin with).
      // Once this function returns, the only things that outlive this
      // tick are the numbers just pushed onto readings and
      // passingFrames: a yaw and pitch angle, an 1024 number
      // embedding, and a score. This is the discard point.

      if (performance.now() - startedAt < CAPTURE_WINDOW_MS) {
        requestAnimationFrame(() => void tick());
        return;
      }

      finish();
    }

    function finish() {
      setPhase("processing");

      if (!sawBrightFrame) {
        setPhase("too-dark");
        return;
      }
      if (!sawAnyFace) {
        setPhase("no-face-detected");
        return;
      }
      if (!livenessOk || !challengeSatisfied(pickedChallenge.id, readings)) {
        setPhase("liveness-not-satisfied");
        return;
      }

      // The best scoring frame among those that passed both gates: not
      // an average, a single real detection, closest to frontal and
      // most confident, which is what a later match against it should
      // be compared to.
      const best = passingFrames.reduce((a, b) => (b.score > a.score ? b : a));
      void submitEnrolment(best.embedding, best.live);
    }

    requestAnimationFrame(() => void tick());
  }

  async function submitEnrolment(embedding: number[], livenessScore: number) {
    setPhase("saving");
    const result = await saveFaceEnrolment({
      embedding,
      livenessScore,
      deviceLabel: navigator.userAgent.slice(0, 200),
    });
    if (result.ok) {
      setPhase("enrolled");
    } else {
      setSaveError(result.error);
      setPhase("save-failed");
    }
  }

  if (phase === "loading-models") {
    return (
      <FaceScreen title="Face check-in">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Spinner />
          <p className="text-base text-muted-foreground">
            Getting ready. This downloads about 8MB, so it can take a moment on mobile data. It only happens
            this once.
          </p>
        </div>
      </FaceScreen>
    );
  }

  if (phase === "requesting-camera") {
    return (
      <FaceScreen title="Face check-in">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Spinner />
          <p className="text-base text-muted-foreground">Asking for camera access...</p>
        </div>
      </FaceScreen>
    );
  }

  if (isFailurePhase(phase)) {
    return (
      <FaceScreen title="Face check-in">
        <div className="flex flex-col gap-4">
          <p className="text-base text-muted-foreground">
            {phase === "save-failed" && saveError ? saveError : FAILURE_MESSAGES[phase]}
          </p>
          <div className="flex flex-col gap-3">
            {phase !== "permission-denied" && phase !== "no-camera" && phase !== "models-failed" ? (
              <Button type="button" onClick={() => setPhase("ready")} className="h-11 rounded-[4px] px-6 text-base">
                Try again
              </Button>
            ) : null}
            <DeferButton />
          </div>
        </div>
      </FaceScreen>
    );
  }

  if (phase === "saving") {
    return (
      <FaceScreen title="Face check-in">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Spinner />
          <p className="text-base text-muted-foreground">Saving...</p>
        </div>
      </FaceScreen>
    );
  }

  if (phase === "enrolled") {
    return (
      <FaceScreen title="Face check-in">
        <div className="flex flex-col gap-4">
          <p className="text-base font-medium">You&apos;re set up.</p>
          <p className="text-base text-muted-foreground">
            You&apos;ll be marked present by face from now on. You can still be checked in by name any time, and
            you can remove this from your account whenever you like.
          </p>
          <Button
            render={<Link href="/account/record">Back to your record</Link>}
            variant="outline"
            className="h-11 self-start rounded-[4px] px-6 text-base"
          />
        </div>
      </FaceScreen>
    );
  }

  return (
    <FaceScreen title="Face check-in">
      <div className="flex flex-col gap-4">
        <video
          ref={attachVideo}
          muted
          playsInline
          // This always requests the front-facing camera (facingMode:
          // "user" above), so a mirrored preview is what everyone
          // expects from a selfie camera: turn your real left, your
          // reflection on screen turns the same way. The raw frame human
          // reads for detection is unaffected: this is a display
          // transform only, not a change to what challengeSatisfied sees.
          className="mx-auto aspect-[4/5] w-full max-w-xs -scale-x-100 rounded-[4px] bg-black object-cover"
        />

        {phase === "ready" ? (
          <>
            <p className="text-base text-muted-foreground">
              When you are ready, we will ask you to make a small movement to confirm it is really you.
            </p>
            <Button type="button" onClick={startCapture} className="h-11 self-start rounded-[4px] px-6 text-base">
              Begin
            </Button>
          </>
        ) : null}

        {phase === "capturing" && challenge ? (
          <p className="text-lg font-medium text-navy-900">{challenge.instruction}</p>
        ) : null}

        {phase === "processing" ? <p className="text-base text-muted-foreground">Checking...</p> : null}

        <DeferButton label="I cannot do this now" />
      </div>
    </FaceScreen>
  );
}

function isFailurePhase(phase: Phase): phase is keyof typeof FAILURE_MESSAGES {
  return phase in FAILURE_MESSAGES;
}

function FaceScreen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-navy-900">{title}</h1>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="size-8 animate-spin rounded-full border-4 border-muted border-t-amber-800"
      role="status"
      aria-label="Loading"
    />
  );
}

// The same escape from every failure state, and from the ready screen
// itself: leaving it to the office is never more than one tap away
// (SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md B1 #6). A plain link, not a
// server action: reaching this screen at all already means section 9
// was completed with consent (setUpFaceEnrolment marks it complete the
// moment "Set up now" is chosen, before capture ever runs), so there is
// nothing left to save by leaving. Calling section 9's own defer action
// from here would wrongly flip that consent back off, exactly the dead
// end the correction to "Set up now" was written to remove.
function DeferButton({ label = "Leave it to the office" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      render={<Link href="/account/record">{label}</Link>}
      className="h-11 w-full rounded-[4px] px-6 text-base"
    />
  );
}
