import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ImportWizard } from "./import-wizard";
import { RecentImports } from "./recent-imports";
import type { RecentImportBatch } from "./recent-imports";

export default async function MembersImportPage() {
  const actor = await requireRole(["WING_ADMIN"]);

  const batches = await prisma.importBatch.findMany({
    where: actor.roles.includes("SUPER_ADMIN") ? {} : { uploadedById: actor.id },
    include: { uploadedBy: { select: { email: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const recentBatches: RecentImportBatch[] = batches.map((batch) => ({
    id: batch.id,
    fileName: batch.fileName,
    status: batch.status,
    rowCount: batch.rowCount,
    successCount: batch.successCount,
    errorCount: batch.errorCount,
    createdAt: batch.createdAt.toLocaleString("en-NG"),
    uploadedByLabel: batch.uploadedBy.email ?? batch.uploadedBy.phone ?? "Unknown",
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Import members</h1>
        <p className="text-sm text-muted-foreground">
          Bring in members already collected on paper or in a spreadsheet. Nothing is written to the
          register until you confirm the preview.
        </p>
      </div>
      <ImportWizard />
      <RecentImports batches={recentBatches} />
    </div>
  );
}
