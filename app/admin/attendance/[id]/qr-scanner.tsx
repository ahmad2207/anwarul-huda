"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";

/**
 * Scans for a QR code using the device camera, entirely in the browser:
 * grabs frames from a hidden video element onto a canvas and runs jsQR
 * against the pixel data, in a loop, until it finds one. jsQR rather than
 * the browser's own BarcodeDetector API, because that API is still not
 * available in Safari or Firefox, and "any phone camera" (docs/SPEC.md
 * 2.6) has to include those.
 */
export function QrScanner({ onScan }: { onScan: (value: string) => void }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        setError("Could not access the camera. Check permission was granted.");
        setActive(false);
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            // A short debounce on the same value, so holding the card
            // steady in frame for a second does not fire the same check
            // in a dozen times before the officer can move it away.
            const now = Date.now();
            const last = lastScanRef.current;
            if (!last || last.value !== code.data || now - last.at > 2000) {
              lastScanRef.current = { value: code.data, at: now };
              onScan(code.data);
            }
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    start();

    return () => {
      cancelled = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [active, onScan]);

  return (
    <div className="flex flex-col gap-2">
      {active ? (
        <div className="relative overflow-hidden rounded-md border">
          <video ref={videoRef} className="w-full" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          setActive((current) => !current);
        }}
      >
        {active ? "Stop scanning" : "Scan QR code"}
      </Button>
    </div>
  );
}
