import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { GlowLogo, Wordmark } from "@/components/member/brand";
import { AuthenticationError, getCurrentUser } from "@/lib/auth";

// The shared shell for every member facing page (/account/*, /library/*).
// A genuinely different layout from AdminShell, not the admin shell with
// its sidebar hidden (MEMBER-INTERFACE.md 3.1): single column, 17px
// base, a fixed bottom navigation bar instead of a rail, settings in the
// header rather than a menu item, because this is read on a mid-range
// Android phone, at arm's length, by a wide age range. A member has
// about four things to do here, so this is deliberately not a
// dashboard.
export async function MemberShell({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect("/login");
    }
    throw error;
  }

  // Same check as app/admin/layout.tsx: a temporary password gets its
  // holder no further than changing it, from every route this shell
  // wraps (/account/*, /library/*), including a direct URL entered by
  // hand rather than a link followed from inside the app.
  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <div className="member-area flex min-h-screen flex-col bg-paper text-ink">
      <header className="on-navy sticky top-0 z-20 bg-gradient-to-b from-navy-950 to-navy-900 text-white shadow-[0_6px_20px_-12px_rgba(4,20,40,0.6)]">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-2 px-4">
          <Link href="/account" className="flex min-h-11 min-w-0 items-center gap-3 rounded-[14px]">
            <GlowLogo size={36} />
            <Wordmark className="min-w-0 truncate text-lg" />
          </Link>
          {/* MEMBER-INTERFACE.md 3.1: settings sits in the header, not the
              bar, and is the only control here. /account/settings holds
              sign out. */}
          <Link
            href="/account/settings"
            aria-label="Settings"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white"
          >
            <Settings className="size-6" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* pb-32: clears the fixed bottom nav (plus the device safe area)
          so the last thing on a page is never hidden behind it. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-32">{children}</main>

      <MemberBottomNav />
    </div>
  );
}
