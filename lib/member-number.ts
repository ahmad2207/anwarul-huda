import type { Prisma } from "@prisma/client";
import { getLagosYear } from "@/lib/timezone";

export class MemberNumberError extends Error {}

interface GenerateMemberNumberInput {
  wingId: string;
  wingNumberLetter: string;
  /** Defaults to the current year in Africa/Lagos. Pass explicitly in tests. */
  year?: number;
}

/**
 * Generates the next member number for a wing and year, in the format
 * AHL/<W>/<YYYY>/<NNNN>.
 *
 * Must be called with the transaction client of an active transaction that
 * also writes the member row, so the number and the row it belongs to
 * commit together.
 *
 * Safe under concurrency: a Postgres advisory lock scoped to the
 * transaction serialises number generation per wing and year, so two
 * approvals happening at the same moment cannot compute the same number.
 * The lock is not a schema object, it needs no migration, and it releases
 * automatically when the transaction commits or rolls back.
 */
export async function generateMemberNumber(
  tx: Prisma.TransactionClient,
  input: GenerateMemberNumberInput,
): Promise<string> {
  const { wingId, wingNumberLetter } = input;
  const year = input.year ?? getLagosYear();

  if (!/^[A-Z]$/.test(wingNumberLetter)) {
    throw new MemberNumberError(`"${wingNumberLetter}" is not a valid wing number letter`);
  }

  const lockKey = advisoryLockKey(`member-number:${wingId}:${year}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

  const prefix = `AHL/${wingNumberLetter}/${year}/`;
  const issuedCount = await tx.member.count({
    where: {
      wingId,
      memberNumber: { startsWith: prefix },
    },
  });

  const sequence = issuedCount + 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

// pg_advisory_xact_lock takes a bigint key, not an arbitrary string, so this
// folds the lock name into a stable 63 bit hash. Collisions between
// different (wing, year) pairs are extremely unlikely and only cost a
// little unnecessary serialisation, never an incorrect number.
function advisoryLockKey(name: string): bigint {
  const multiplier = BigInt(31);
  const mask = BigInt("0x7fffffffffffffff");
  let hash = BigInt(0);
  for (let i = 0; i < name.length; i++) {
    hash = (hash * multiplier + BigInt(name.charCodeAt(i))) & mask;
  }
  return hash;
}
