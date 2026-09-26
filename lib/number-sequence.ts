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
  const rows = await tx.$queryRaw<{ last_issued: number }[]>`
    INSERT INTO number_sequences (key, last_issued, updated_at)
    VALUES (${key}, ${highestExisting + 1}, now())
    ON CONFLICT (key) DO UPDATE
      SET last_issued = GREATEST(number_sequences.last_issued, ${highestExisting}) + 1,
          updated_at = now()
    RETURNING last_issued
  `;
  return rows[0].last_issued;
}
