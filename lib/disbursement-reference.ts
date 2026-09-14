import type { Prisma } from "@prisma/client";
import { getLagosYear } from "@/lib/timezone";
import { withNamedLock } from "@/lib/advisory-lock";

interface GenerateDisbursementReferenceInput {
  /** Defaults to the current year in Africa/Lagos. Pass explicitly in tests. */
  year?: number;
}

/**
 * Generates the next disbursement reference for a year, in the format
 * DSB/<YYYY>/<NNNNNN>. Same advisory lock pattern as member, receipt and
 * case reference numbers.
 */
export async function generateDisbursementReference(
  tx: Prisma.TransactionClient,
  input: GenerateDisbursementReferenceInput = {},
): Promise<string> {
  const year = input.year ?? getLagosYear();

  await withNamedLock(tx, `disbursement-reference:${year}`);

  const prefix = `DSB/${year}/`;
  const issuedCount = await tx.disbursement.count({
    where: { reference: { startsWith: prefix } },
  });

  const sequence = issuedCount + 1;
  return `${prefix}${String(sequence).padStart(6, "0")}`;
}
