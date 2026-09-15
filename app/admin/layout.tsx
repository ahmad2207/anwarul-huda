import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AuthenticationError, getCurrentUser } from "@/lib/auth";

// The auth check every admin page depends on, still applied to every
// route under /admin/* without exception, including check-in. Which
// shell wraps the result of that check (the sidebar, or nothing at all
// for check-in's own full bleed surface) is AdminShell's decision, made
// from the current path, not this layout's.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect("/login");
    }
    throw error;
  }

  // A signed in account with no staff role at all is a member account,
  // not an administrator (the MEMBER value in the RoleName enum is never
  // actually assigned; an ordinary member simply has no role rows). Every
  // individual /admin/* page already requires a specific staff role and
  // would reject such an account anyway, but that surfaces as a raw
  // authorization error on whatever page they land on first, rather than
  // sending them where they actually belong.
  if (user.roles.length === 0) {
    redirect("/account");
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
