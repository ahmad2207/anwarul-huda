import type { Prisma } from "@prisma/client";
import { getLagosYear } from "@/lib/timezone";
import { withNamedLock } from "@/lib/advisory-lock";

interface GenerateReceiptNumberInput {
  /** Defaults to the current year in Africa/Lagos. Pass explicitly in tests. */
  year?: number;
}

/**
 * Generates the next receipt number for a year, in the format
 * RCT/<YYYY>/<NNNNNN>.
 *
 * Must be called with the transaction client of an active transaction that
 * also writes the payment row, so the number and the payment it belongs
 * to commit together. Safe under concurrency the same way
 * lib/member-number.ts is: a Postgres advisory lock scoped to the
 * transaction serialises number generation per year, so two officers
 * recording a payment at the same moment cannot compute the same number.
 */
export async function generateReceiptNumber(
  tx: Prisma.TransactionClient,
  input: GenerateReceiptNumberInput = {},
): Promise<string> {
  const year = input.year ?? getLagosYear();

  await withNamedLock(tx, `receipt-number:${year}`);

  const prefix = `RCT/${year}/`;
  const issuedCount = await tx.payment.count({
    where: { receiptNumber: { startsWith: prefix } },
  });

  const sequence = issuedCount + 1;
  return `${prefix}${String(sequence).padStart(6, "0")}`;
}
