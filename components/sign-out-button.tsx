"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

// Shared by the admin sidebar (the default look, unchanged) and the
// member settings page, which asks for the larger member-area version.
export function SignOutButton({
  className,
  appearance = "admin",
}: { className?: string; appearance?: "admin" | "member" } = {}) {
  if (appearance === "member") {
    return (
      <button
        type="button"
        className={cn(
          "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-border bg-white px-6 text-base font-semibold text-alert transition-colors hover:bg-alert-soft",
          className,
        )}
        onClick={() => signOut({ redirectTo: "/login" })}
      >
        <LogOut className="size-5" aria-hidden="true" />
        Sign out
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("w-full", className)}
      onClick={() => signOut({ redirectTo: "/login" })}
    >
      Sign out
    </Button>
  );
}
