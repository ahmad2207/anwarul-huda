import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { AuthenticationError, getCurrentUser } from "@/lib/auth";

// The plain, single-column shell for every /account/* page: a member's own
// view of their record, contributions and content. No sidebar, this is
// meant to be light on a slow connection.
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <span className="text-sm font-medium">Anwar-ul-Huda League</span>
        <SignOutButton />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
