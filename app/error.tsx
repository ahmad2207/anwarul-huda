"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { GlowLogo } from "@/components/member/brand";

// Catches anything not already handled further down the tree, so a
// broken page shows a plain, on-brand message instead of Next's own
// default error screen. The real error is only logged, never rendered.
// It does not promise that work was saved: if a form was being sent
// when this happened, it may not have been.
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="member-area flex min-h-screen flex-col items-center justify-center gap-5 bg-paper px-4 py-12 text-center text-ink">
      <div className="on-navy rounded-full bg-navy-950 p-5">
        <GlowLogo size={56} />
      </div>
      <h1 className="font-heading text-2xl font-semibold text-navy-900">Something went wrong</h1>
      <p className="max-w-md text-base text-ink-2">
        This page could not be shown. Try again in a moment. If you were saving something, check
        afterwards that it was saved before entering it again.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-navy-950 px-6 text-base font-semibold text-white hover:bg-navy-800"
        >
          <RotateCcw className="size-5" aria-hidden="true" />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-[14px] border border-border bg-white px-6 text-base font-semibold text-navy-900 hover:bg-paper-dim/60"
        >
          Go to the start
        </Link>
      </div>
    </main>
  );
}
