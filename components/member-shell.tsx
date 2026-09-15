import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { AuthenticationError, getCurrentUser } from "@/lib/auth";

// The shared shell for every member facing page (/account/*, /library/*),
// DESIGN.md section 4.2: single column, no sidebar, a 17px base rather
// than the admin desk's 14px, since this is read on a mid-range Android
// phone, at arm's length, by a wide age range. A member has about four
// things to do here, so this is deliberately not a dashboard.
//
// Was two nearly identical copies (app/account/layout.tsx,
// app/library/layout.tsx), one per route the build plan added at a
// different phase. Folded into one now that both are actually being
// touched, rather than carrying the duplication forward again.
export async function MemberShell({ children }: { children: React.ReactNode }) {
  try {
    await getCurrentUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-6 text-[17px]">
      <header className="flex items-center justify-between gap-3">
        <Link href="/account" className="text-lg font-medium">
          Anwar-ul-Huda League
        </Link>
        <SignOutButton className="h-11 w-auto px-4" />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
