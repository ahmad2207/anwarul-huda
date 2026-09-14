import type { Prisma } from "@prisma/client";
import { getLagosYear } from "@/lib/timezone";
import { withNamedLock } from "@/lib/advisory-lock";

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

  await withNamedLock(tx, `member-number:${wingId}:${year}`);

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
