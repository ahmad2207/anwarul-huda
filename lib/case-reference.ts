import type { Prisma } from "@prisma/client";
import { getLagosYear } from "@/lib/timezone";
import { withNamedLock } from "@/lib/advisory-lock";

interface GenerateCaseReferenceInput {
  /** Defaults to the current year in Africa/Lagos. Pass explicitly in tests. */
  year?: number;
}

/**
 * Generates the next beneficiary case reference for a year, in the
 * format CASE/<YYYY>/<NNNNNN>. Same pattern as member and receipt
 * numbers: a Postgres advisory lock scoped to the transaction serialises
 * generation per year, so two officers registering a case at the same
 * moment cannot compute the same reference.
 */
export async function generateCaseReference(
  tx: Prisma.TransactionClient,
  input: GenerateCaseReferenceInput = {},
): Promise<string> {
  const year = input.year ?? getLagosYear();

  await withNamedLock(tx, `case-reference:${year}`);

  const prefix = `CASE/${year}/`;
  const issuedCount = await tx.charityCase.count({
    where: { reference: { startsWith: prefix } },
  });

  const sequence = issuedCount + 1;
  return `${prefix}${String(sequence).padStart(6, "0")}`;
}
