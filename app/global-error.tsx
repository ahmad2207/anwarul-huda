"use client";

import { useEffect } from "react";

// Only reached if the root layout itself throws (rare enough that most
// errors hit app/error.tsx instead), which is why this has to render its
// own full <html> and <body>: at this point the root layout has failed
// too, so nothing above this can be relied on to still be there.
export default function GlobalError({
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
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: "#666" }}>
            The application ran into a problem loading this page. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              borderRadius: "0.5rem",
              border: "1px solid #ccc",
              padding: "0.4rem 0.9rem",
              fontSize: "0.875rem",
              cursor: "pointer",
              background: "white",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
