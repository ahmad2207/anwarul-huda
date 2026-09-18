import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { MemberBottomNav } from "@/components/member-bottom-nav";
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
    <div className="flex min-h-screen flex-col bg-background text-[17px]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-navy-900 px-3 text-white">
        <Link href="/account" className="min-w-0 truncate text-base font-semibold">
          Anwaru-l-Huda League
        </Link>
        {/* MEMBER-INTERFACE.md 3.1: settings sits in the header, not the
            bar, and is the only control here. /account/settings now
            holds sign out, since a member leaves the account from
            settings, not from a second button living beside the gear. */}
        <Link
          href="/account/settings"
          aria-label="Settings"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
        >
          <Settings className="size-5" aria-hidden="true" />
        </Link>
      </header>

      {/* pb-28: clears the fixed bottom nav's own height (min-h-14, plus
          the device's safe area) so the last thing on a page is never
          hidden behind it. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-28">{children}</main>

      <MemberBottomNav />
    </div>
  );
}
