"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, Home, Wallet } from "lucide-react";

// MEMBER-INTERFACE.md 3.1: four destinations, thumb reachable, always
// visible, because a hamburger menu is neither. Attendance and face are
// reached from Home and from the record, not from here: four is the
// limit before the labels stop being readable at 17px.
//
// "Books" points at /library, not /account/library: the routing table
// in 3.1 names the destination /account/library, but /library already
// exists as its own route from an earlier phase, wrapped in this same
// shell already. Moving it under /account is a bigger, separate change
// (it has its own nested routes) than this task asked for, so this
// links to what already exists rather than silently restructuring it.
const DESTINATIONS = [
  { href: "/account", label: "Home", icon: Home, isActive: (path: string) => path === "/account" },
  {
    href: "/account/record",
    label: "Record",
    icon: FileText,
    isActive: (path: string) => path.startsWith("/account/record"),
  },
  {
    href: "/account/payments",
    label: "Payments",
    icon: Wallet,
    isActive: (path: string) => path.startsWith("/account/payments"),
  },
  { href: "/library", label: "Books", icon: BookOpen, isActive: (path: string) => path.startsWith("/library") },
] as const;

export function MemberBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-navy-900 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-2xl">
        {DESTINATIONS.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              // min-h-14 (56px): comfortably past the 44px minimum, since
              // this is the one control used with a thumb while walking
              // in, not a mouse.
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                active ? "text-amber-500" : "text-white/60 hover:text-white/80"
              }`}
            >
              <Icon className="size-6" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
