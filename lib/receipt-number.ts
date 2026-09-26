import type { Prisma } from "@prisma/client";
import { getLagosYear } from "@/lib/timezone";
import { nextInSequence } from "@/lib/number-sequence";

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
 * to commit or roll back together.
 *
 * The sequence comes from a counter (lib/number-sequence.ts), not from
 * counting existing receipts. Counting was safe under concurrency but not
 * against a missing row: with receipts 000001 and 000003 present, the
 * count gave 000003 again, the payment failed on the unique receipt
 * number, and every payment after it failed the same way, since the count
 * never moved. The highest existing number is still read, as a floor, so
 * the counter can never fall behind receipts already issued.
 */
export async function generateReceiptNumber(
  tx: Prisma.TransactionClient,
  input: GenerateReceiptNumberInput = {},
): Promise<string> {
  const year = input.year ?? getLagosYear();
  const prefix = `RCT/${year}/`;

  const [{ highest }] = await tx.$queryRaw<{ highest: number | null }[]>`
    SELECT MAX(CAST(substring(receipt_number from CAST(${prefix.length + 1} AS integer)) AS integer)) AS highest
    FROM payments
    WHERE receipt_number LIKE ${`${prefix}%`}
      AND substring(receipt_number from CAST(${prefix.length + 1} AS integer)) ~ '^[0-9]+$'
  `;

  const sequence = await nextInSequence(tx, `receipt:${year}`, highest ?? 0);
  return `${prefix}${String(sequence).padStart(6, "0")}`;
}
