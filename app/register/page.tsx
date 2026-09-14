import { prisma } from "@/lib/prisma";
import { RegisterForm } from "./register-form";

// Public route, no auth check: this is where a prospective member signs
// themselves up. Creates a PENDING record for a wing administrator to
// review at /admin/approvals. Nothing here activates an account.
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
