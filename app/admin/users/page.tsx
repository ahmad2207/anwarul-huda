import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StatusTag } from "@/components/status-tag";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { STAFF_ROLE_LABELS } from "./schema";
import { CreateStaffUserForm } from "./create-staff-user-form";

interface StaffRow {
  id: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  roles: string[];
  wingNames: string[];
}

export default async function UsersPage() {
  const actor = await requireRole(["SUPER_ADMIN", "WING_ADMIN"]);
  const isSuperAdmin = actor.roles.includes("SUPER_ADMIN");

  const [staff, wings] = await Promise.all([
    prisma.user.findMany({
      where: {
        memberId: null,
        ...(isSuperAdmin ? {} : { wingAssignments: { some: { wingId: { in: actor.wingIds } } } }),
      },
      include: { roles: true, wingAssignments: { include: { wing: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.wing.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows: StaffRow[] = staff.map((user) => ({
    id: user.id,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    roles: user.roles.map((r) => r.role),
    wingNames: user.wingAssignments.map((w) => w.wing.name),
  }));

  const columns: DataTableColumn<StaffRow>[] = [
    { key: "email", header: "Email", cell: (row) => row.email ?? "—" },
    {
      key: "roles",
      header: "Roles",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.map((role) => (
            <StatusTag key={role} tone="neutral">
              {STAFF_ROLE_LABELS[role as keyof typeof STAFF_ROLE_LABELS] ?? role}
            </StatusTag>
          ))}
        </div>
      ),
    },
    { key: "wing", header: "Wing", cell: (row) => (row.wingNames.length > 0 ? row.wingNames.join(", ") : "All wings") },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusTag tone={row.isActive ? "confirmed" : "neutral"}>{row.isActive ? "Active" : "Inactive"}</StatusTag>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Admin and staff accounts" description="Every non-member account, and who can create more." />

      <CreateStaffUserForm
        isSuperAdmin={isSuperAdmin}
        wings={wings.map((wing) => ({ id: wing.id, name: wing.name }))}
        actorWingIds={actor.wingIds}
      />

      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} emptyMessage="No staff accounts yet." />
    </div>
  );
}
