import { prisma } from "@/lib/prisma";
import { RegisterForm } from "./register-form";

// Public route, no auth check: this is where a prospective member signs
// themselves up. Creates a PENDING record for a wing administrator to
// review at /admin/approvals. Nothing here activates an account.
//
// Forced dynamic rather than left to prerender: this is the one page in
// the app that queries the database without also calling any auth
// helper (every other database-backed page reads the session, an
// intrinsically dynamic API, which already opts it out of static
// generation on its own). Without this, Next.js has no dynamic API to
// notice here and quietly prerenders the page once at build time,
// baking in whatever wings, branches and service areas existed then and
// making every build fail outright if the database happens to be
// unreachable at that moment, exactly what broke the Vercel build.
// Wings, branches and active service areas change rarely enough that a
// cached, periodically revalidated version was worth considering, but
// that still fetches once at build time to produce the initial cache,
// which does not fix "every build depends on the database being
// reachable", only how often afterwards. Fully dynamic is the version
// that actually removes that dependency.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const [wings, branches, serviceAreas] = await Promise.all([
    prisma.wing.findMany({ orderBy: { name: "asc" } }),
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    prisma.serviceArea.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <RegisterForm wings={wings} branches={branches} serviceAreas={serviceAreas} />
    </div>
  );
}
