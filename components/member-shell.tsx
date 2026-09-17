import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
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
        <div className="flex shrink-0 items-center gap-1">
          {/* /account/settings is not built yet (it is not part of this
              build); the link is wired to where it belongs regardless,
              rather than leaving the gear with nowhere to go. Sign out
              sits here too, only until settings exists to hold it: the
              routing table names settings for "password, phone,
              notification preferences", not for signing out, but a
              member needs a way to leave the account today. */}
          <Link
            href="/account/settings"
            aria-label="Settings"
            className="flex size-11 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Settings className="size-5" aria-hidden="true" />
          </Link>
          <SignOutButton className="h-11 w-auto border-white/25 bg-transparent px-3 text-sm text-white hover:bg-white/10 hover:text-white" />
        </div>
      </header>

      {/* pb-28: clears the fixed bottom nav's own height (min-h-14, plus
          the device's safe area) so the last thing on a page is never
          hidden behind it. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-28">{children}</main>

      <MemberBottomNav />
    </div>
  );
}
