"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Catches anything not already handled further down the tree, so a
// broken page shows a plain, on-brand message instead of Next's own
// default error screen. The real error is only logged, never rendered:
// a raw error message or stack trace is not something a member or an
// officer using this system should ever have to read.
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page ran into a problem. Nothing you were doing has been lost; try again, or go back to the
        start.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" render={<Link href="/">Go home</Link>} />
      </div>
    </div>
  );
}
