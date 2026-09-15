import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { AuthenticationError, getCurrentUser } from "@/lib/auth";

// The same plain, single column, no sidebar shell as /account/*: light on
// a slow connection, since this is a member facing page, not an admin
// one. Kept as its own layout rather than moving this route under
// /account, since the build plan names /library as its own top level
// path.
export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  try {
    await getCurrentUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/account" className="text-sm font-medium">
          Anwar-ul-Huda League
        </Link>
        <SignOutButton />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
