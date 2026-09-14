import type { Member, Prisma, PrismaClient } from "@prisma/client";

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

const NAME_SIMILARITY_THRESHOLD = 0.72;
const FUZZY_CANDIDATE_LIMIT = 200;

export interface DuplicateCandidateInput {
  /** Excluded from the search, so a member never flags itself as a duplicate of itself. */
  id?: string;
  phone: string;
  surname: string;
  firstName: string;
}

export interface DuplicateMatch {
  member: Member;
  matchedOnPhone: boolean;
  matchedOnName: boolean;
  /** 0 to 1. Only meaningful when matchedOnName is true. */
  nameSimilarity: number;
}

/**
 * Finds members that are likely the same person as the candidate: an exact
 * phone match, or a fuzzy match on surname and first name. Used by the
 * approval queue, so a wing administrator can see likely duplicates side
 * by side before approving a new registration, because in practice the
 * same person registers twice.
 */
export async function findPotentialDuplicates(
  client: PrismaClientOrTransaction,
  candidate: DuplicateCandidateInput,
): Promise<DuplicateMatch[]> {
  const excludeSelf = candidate.id ? { id: { not: candidate.id } } : {};

  const phoneMatches = await client.member.findMany({
    where: { phone: candidate.phone, ...excludeSelf },
  });

  // A loose prefix search narrows the field before the more expensive
  // similarity comparison runs in memory. Comparing against every member
  // in the register does not scale once there are thousands of them.
  const surnameFragment = candidate.surname.trim().slice(0, 3);
  const nameCandidates = surnameFragment
    ? await client.member.findMany({
        where: {
          surname: { contains: surnameFragment, mode: "insensitive" },
          ...excludeSelf,
        },
        take: FUZZY_CANDIDATE_LIMIT,
      })
    : [];

  const matches = new Map<string, DuplicateMatch>();

  for (const member of phoneMatches) {
    matches.set(member.id, {
      member,
      matchedOnPhone: true,
      matchedOnName: false,
      nameSimilarity: 0,
    });
  }

  for (const member of nameCandidates) {
    const similarity = nameSimilarity(
      `${candidate.surname} ${candidate.firstName}`,
      `${member.surname} ${member.firstName}`,
    );
    if (similarity < NAME_SIMILARITY_THRESHOLD) {
      continue;
    }

    const existing = matches.get(member.id);
    if (existing) {
      existing.matchedOnName = true;
      existing.nameSimilarity = similarity;
    } else {
      matches.set(member.id, {
        member,
        matchedOnPhone: false,
        matchedOnName: true,
        nameSimilarity: similarity,
      });
    }
  }

  return Array.from(matches.values()).sort((a, b) => b.nameSimilarity - a.nameSimilarity);
}

/** Similarity between two names, 0 (nothing alike) to 1 (identical once normalised). */
export function nameSimilarity(a: string, b: string): number {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (left === right) {
    return 1;
  }
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const distance = levenshteinDistance(left, right);
  const maxLength = Math.max(left.length, right.length);
  return 1 - distance / maxLength;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = [];

  for (let i = 0; i < rows; i++) {
    matrix.push(new Array<number>(cols).fill(0));
    matrix[i][0] = i;
  }
  for (let j = 0; j < cols; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}
