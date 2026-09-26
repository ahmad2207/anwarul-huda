import type { Prisma } from "@prisma/client";

/**
 * Issues the next number in a series, in one atomic statement, inside the
 * caller's transaction.
 *
 * - The first number for a key starts one above `highestExisting`, so a
 *   series that already has rows (from before this table existed, or
 *   entered some other way) carries on from them.
 * - Every later number is one above the last one issued, and never below
 *   `highestExisting`, so a restored database or a row added by hand can
 *   never be collided with.
 * - It never goes backwards: a row carrying an earlier number being
 *   removed cannot make that number come round again, which is exactly
 *   what counting existing rows got wrong.
 *
 * Concurrency: two callers for the same key serialise on the counter
 * row's lock, and a first-ever pair racing to create it resolves through
 * ON CONFLICT, so each gets a different number with no advisory lock.
 * Because it runs in the caller's transaction, a rollback undoes the
 * increment too, so an abandoned payment leaves no gap.
 */
export async function nextInSequence(
  tx: Prisma.TransactionClient,
  key: string,
  highestExisting: number,
): Promise<number> {
  const [first] = await reserveInSequence(tx, key, highestExisting, 1);
  return first;
}

/**
 * The same, reserving `count` consecutive numbers at once, for a bulk
 * import that numbers many rows in one transaction. Returns them in order.
 */
export async function reserveInSequence(
  tx: Prisma.TransactionClient,
  key: string,
  highestExisting: number,
  count: number,
): Promise<number[]> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("count must be a whole number of at least 1");
  }
  const rows = await tx.$queryRaw<{ last_issued: number }[]>`
    INSERT INTO number_sequences (key, last_issued, updated_at)
    VALUES (${key}, CAST(${highestExisting + count} AS integer), now())
    ON CONFLICT (key) DO UPDATE
      SET last_issued = GREATEST(number_sequences.last_issued, CAST(${highestExisting} AS integer)) + CAST(${count} AS integer),
          updated_at = now()
    RETURNING last_issued
  `;
  const last = rows[0].last_issued;
  return Array.from({ length: count }, (_, index) => last - count + 1 + index);
}
