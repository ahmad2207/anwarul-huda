import { redirect } from "next/navigation";
import { AuthenticationError, getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

// Deliberately outside both app/admin's and MemberShell's layout trees:
// this is the one page a mustChangePassword account can always reach, so
// it must never itself be wrapped by a layout that would redirect back
// here and loop.
export default async function ChangePasswordPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <ChangePasswordForm forced={user.mustChangePassword} />
    </div>
  );
}
