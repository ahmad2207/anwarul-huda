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

// AHL / <wing letter> / <4 digit year> / <4 digit sequence>, with no
// assumption baked in here about which letters exist: that is Wing.
// numberLetter's business, not this parser's, and generateMemberNumber
// above already accepts any single uppercase letter.
const MEMBER_NUMBER_PATTERN = /^AHL([A-Z])(\d{4})(\d{4})$/;

/**
 * Normalises a member number typed by hand into its canonical
 * AHL/<W>/<YYYY>/<NNNN> form, or returns null if the input does not
 * resolve to one at all. Punctuation is not meaningful to a member
 * number, only decoration, so every separator is stripped before
 * matching: "ahl m 2026 0113", "AHLM20260113" and "AHL/M/2026/0113" all
 * normalise to the same string. Used both to look a member number up
 * (auth.ts) and to key its login lockout bucket (lib/login-lockout.ts),
 * so a member cannot dodge a lockout by retyping the same number with
 * different punctuation.
 */
export function normalizeMemberNumberInput(input: string): string | null {
  const stripped = input.replace(/[\s/-]/g, "").toUpperCase();
  const match = stripped.match(MEMBER_NUMBER_PATTERN);
  if (!match) {
    return null;
  }
  const [, letter, year, sequence] = match;
  return `AHL/${letter}/${year}/${sequence}`;
}
