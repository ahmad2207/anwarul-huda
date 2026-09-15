"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Scoped to /admin/*, so the sidebar and header from app/admin/layout.tsx
// stay on screen (this only replaces the page content inside them), and
// an officer mid-task can see clearly this is a page problem, not that
// they have been signed out or lost their place in the app.
export default function AdminErrorBoundary({
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
    <div className="flex flex-col items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
      <div>
        <h1 className="text-base font-semibold">This page ran into a problem</h1>
        <p className="text-sm text-muted-foreground">
          Nothing has been saved that should not have been. Try again, or use the sidebar to go elsewhere.
        </p>
      </div>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
