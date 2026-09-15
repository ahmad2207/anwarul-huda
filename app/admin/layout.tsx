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

  return <AdminShell user={user}>{children}</AdminShell>;
}
