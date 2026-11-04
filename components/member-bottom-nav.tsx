"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, Home, Wallet } from "lucide-react";

// MEMBER-INTERFACE.md 3.1: four destinations, thumb reachable, always
// visible, because a hamburger menu is neither. Attendance and face are
// reached from Home and from the record, not from here.
//
// "Books" points at /library, which already exists as its own route
// wrapped in this same shell, rather than /account/library.
//
// The current destination is shown by more than colour (DESIGN.md 2):
// a lit amber dot above the icon, bolder label text, and aria-current.
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
      className="on-navy fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-navy-950 to-navy-900 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-14px_rgba(4,20,40,0.7)]"
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
              className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] pt-2 pb-1.5 text-xs transition-colors ${
                active ? "font-bold text-white" : "font-medium text-white/70 hover:text-white"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-1 size-1.5 rounded-full ${
                  active ? "bg-amber-500 shadow-[0_0_10px_3px_rgba(255,151,0,0.6)]" : "bg-transparent"
                }`}
              />
              <Icon className={`size-5 ${active ? "text-amber-300" : ""}`} aria-hidden="true" strokeWidth={active ? 2.4 : 1.8} />
              <span className={active ? "underline decoration-amber-500 decoration-2 underline-offset-4" : ""}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
