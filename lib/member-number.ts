import type { Prisma } from "@prisma/client";
import { getLagosYear } from "@/lib/timezone";
import { reserveInSequence } from "@/lib/number-sequence";

export class MemberNumberError extends Error {}

interface GenerateMemberNumberInput {
  /** The member's wing. Numbering itself goes by wingNumberLetter, the letter that appears in the number. */
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
 * Never reused (CLAUDE.md): see reserveMemberNumberBlock below.
 */
export async function generateMemberNumber(
  tx: Prisma.TransactionClient,
  input: GenerateMemberNumberInput,
): Promise<string> {
  const [number] = await reserveMemberNumberBlock(tx, { ...input, count: 1 });
  return number;
}

/**
 * Reserves `count` consecutive member numbers for a wing letter and year
 * in one statement, for a caller creating many members in bulk (a nominal
 * roll import), which then bulk-inserts them. generateMemberNumber above
 * is this with count fixed to 1. Reserving the whole block up front keeps
 * a large file from costing a round trip per member against the
 * networked database.
 *
 * The numbers come from a counter per wing letter and year
 * (lib/number-sequence.ts), not from counting members. Counting reissued
 * numbers already in use: it counted per wing, so moving a member to
 * another wing, number and all, dropped the old wing's count, and the
 * next approval there was given that member's number again. A removed
 * test row did the same. The highest number already issued under the
 * prefix, in any wing, is read as a floor, so the counter can never fall
 * behind it. Two approvals at the same moment serialise on the counter
 * row, so they cannot get the same number either.
 */
export async function reserveMemberNumberBlock(
  tx: Prisma.TransactionClient,
  input: GenerateMemberNumberInput & { count: number },
): Promise<string[]> {
  const { wingNumberLetter, count } = input;
  const year = input.year ?? getLagosYear();

  if (!/^[A-Z]$/.test(wingNumberLetter)) {
    throw new MemberNumberError(`"${wingNumberLetter}" is not a valid wing number letter`);
  }
  if (count < 1) {
    throw new MemberNumberError("count must be at least 1");
  }

  const prefix = `AHL/${wingNumberLetter}/${year}/`;
  // Every member under this prefix, whatever wing they are in now.
  const [{ highest }] = await tx.$queryRaw<{ highest: number | null }[]>`
    SELECT MAX(CAST(substring(member_number from CAST(${prefix.length + 1} AS integer)) AS integer)) AS highest
    FROM members
    WHERE member_number LIKE ${`${prefix}%`}
      AND substring(member_number from CAST(${prefix.length + 1} AS integer)) ~ '^[0-9]+$'
  `;

  const sequence = await reserveInSequence(tx, `member:${wingNumberLetter}:${year}`, highest ?? 0, count);
  return sequence.map((value) => `${prefix}${String(value).padStart(4, "0")}`);
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
