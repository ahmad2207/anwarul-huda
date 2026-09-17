import Link from "next/link";
import type { Member, MemberDuplicateFlag } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMemberName } from "@/lib/members/display-name";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { dismissDuplicateFlag } from "./actions";

type FlagRow = MemberDuplicateFlag & { memberA: Member; memberB: Member };

export default async function DuplicateFlagsPage() {
  const user = await requireRole(["WING_ADMIN"]);
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");

  const flags = await prisma.memberDuplicateFlag.findMany({
    where: {
      status: "PENDING",
      ...(isSuperAdmin
        ? {}
        : {
            OR: [{ memberA: { wingId: { in: user.wingIds } } }, { memberB: { wingId: { in: user.wingIds } } }],
          }),
    },
    include: { memberA: true, memberB: true },
    orderBy: { createdAt: "asc" },
  });

  const columns: DataTableColumn<FlagRow>[] = [
    {
      key: "pair",
      header: "Possible duplicate",
      cell: (flag) => (
        <div className="flex flex-col gap-1">
          <Link href={`/admin/members/${flag.memberA.id}`} className="font-medium underline underline-offset-4">
            {formatMemberName(flag.memberA)} ({flag.memberA.memberNumber ?? "pending"})
          </Link>
          <Link href={`/admin/members/${flag.memberB.id}`} className="font-medium underline underline-offset-4">
            {formatMemberName(flag.memberB)} ({flag.memberB.memberNumber ?? "pending"})
          </Link>
        </div>
      ),
    },
    { key: "reason", header: "Reason", cell: (flag) => <p className="max-w-sm text-xs">{flag.reason}</p> },
    { key: "flagged", header: "Flagged", cell: (flag) => flag.createdAt.toLocaleDateString("en-NG") },
    {
      key: "actions",
      header: "Actions",
      cell: (flag) => (
        <form action={dismissDuplicateFlag}>
          <input type="hidden" name="flagId" value={flag.id} />
          <Button type="submit" variant="outline" size="sm">
            Dismiss
          </Button>
        </form>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Duplicate flags"
        description={`${flags.length} pair${flags.length === 1 ? "" : "s"} flagged as a possible duplicate. Merging records is not done here; open both profiles to decide.`}
      />

      <DataTable
        columns={columns}
        rows={flags}
        rowKey={(flag) => flag.id}
        emptyMessage="Nothing flagged."
        alignRowsTop
      />
    </div>
  );
}
