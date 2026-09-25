import { redirect } from "next/navigation";
import { AuthenticationError, AuthorizationError, PasswordChangeRequiredError } from "@/lib/auth";

// Route handlers (the CSV exports and the import template) do not pass
// through app/admin/layout.tsx, so its redirects never apply to them.
// Without this, the errors requireRole and requireWingAccess throw
// became a 500 page: a signed out officer following an export link saw
// a server error instead of the login screen. Nothing was ever exposed,
// since the check throws before any data is read; this only turns each
// refusal into the response a person can act on.
export function withRouteAuth<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        redirect("/login");
      }
      if (error instanceof PasswordChangeRequiredError) {
        redirect("/change-password");
      }
      if (error instanceof AuthorizationError) {
        return new Response("You don't have permission to download this.", {
          status: 403,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      throw error;
    }
  };
}
