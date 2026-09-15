"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export function SignOutButton({ className }: { className?: string } = {}) {
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
