import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ArrearsRow {
  memberId: string;
  surname: string;
  firstName: string;
  memberNumber: string | null;
  wingId: string;
  wingName: string;
  outstandingKobo: number;
  recordCount: number;
}

interface RawArrearsRow {
  memberId: string;
  surname: string;
  firstName: string;
  memberNumber: string | null;
  wingId: string;
  wingName: string;
  outstandingKobo: bigint;
  recordCount: bigint;
}

export interface ArrearsQueryOptions {
  /** Name or member number, case insensitive. */
  search?: string;
  limit?: number;
  offset?: number;
  /** The moment arrears are measured at. Only periods that have ended by then count. */
  now?: Date;
}

function arrearsConditions(wingId: string | undefined, options: ArrearsQueryOptions): Prisma.Sql {
  const now = options.now ?? new Date();
  const wingFilter = wingId ? Prisma.sql`AND m.wing_id = ${wingId}` : Prisma.empty;
  const search = options.search?.trim();
  // A literal % or _ typed in the search box matches itself, not "anything".
  const pattern = search ? `%${search.replace(/[\\%_]/g, (char) => "\\" + char)}%` : null;
  const searchFilter = pattern
    ? Prisma.sql`AND (m.surname ILIKE ${pattern} OR m.first_name ILIKE ${pattern} OR m.member_number ILIKE ${pattern})`
    : Prisma.empty;

  // A period still running is not arrears yet: a member is only behind on
  // a period once it has ended. Without this, every member showed as in
  // arrears from the first day of each month.
  return Prisma.sql`
    cr.amount_paid_kobo < cr.amount_due_kobo
    AND cr.period_end <= ${now}
    AND m.status = 'ACTIVE'
    ${wingFilter}
    ${searchFilter}
  `;
}

/**
 * Every active member with at least one ended contribution period not yet
 * paid in full, and how much they owe in total across every such period,
 * largest first. Comparing amountPaidKobo against amountDueKobo is a
 * column-to-column comparison Prisma's query builder cannot express, so
 * this is raw SQL, parameterised through Prisma.sql rather than string
 * concatenation. Without a limit it returns every row, for the CSV export.
 */
export async function getArrearsReport(wingId?: string, options: ArrearsQueryOptions = {}): Promise<ArrearsRow[]> {
  const paging =
    options.limit !== undefined
      ? Prisma.sql`LIMIT ${options.limit} OFFSET ${options.offset ?? 0}`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<RawArrearsRow[]>(Prisma.sql`
    SELECT
      m.id AS "memberId",
      m.surname AS surname,
      m.first_name AS "firstName",
      m.member_number AS "memberNumber",
      w.id AS "wingId",
      w.name AS "wingName",
      SUM(cr.amount_due_kobo - cr.amount_paid_kobo)::bigint AS "outstandingKobo",
      COUNT(*)::bigint AS "recordCount"
    FROM contribution_records cr
    JOIN members m ON m.id = cr.member_id
    JOIN wings w ON w.id = m.wing_id
    WHERE ${arrearsConditions(wingId, options)}
    GROUP BY m.id, m.surname, m.first_name, m.member_number, w.id, w.name
    ORDER BY "outstandingKobo" DESC, m.surname ASC, m.id ASC
    ${paging}
  `);

  return rows.map((row) => ({
    ...row,
    outstandingKobo: Number(row.outstandingKobo),
    recordCount: Number(row.recordCount),
  }));
}

/** How many members are in arrears and how much they owe in total, for the same filters as getArrearsReport. */
export async function getArrearsSummary(
  wingId?: string,
  options: Omit<ArrearsQueryOptions, "limit" | "offset"> = {},
): Promise<{ memberCount: number; outstandingKobo: number }> {
  const [row] = await prisma.$queryRaw<{ memberCount: bigint; outstandingKobo: bigint | null }[]>(Prisma.sql`
    SELECT
      COUNT(DISTINCT m.id)::bigint AS "memberCount",
      SUM(cr.amount_due_kobo - cr.amount_paid_kobo)::bigint AS "outstandingKobo"
    FROM contribution_records cr
    JOIN members m ON m.id = cr.member_id
    WHERE ${arrearsConditions(wingId, options)}
  `);
  return { memberCount: Number(row?.memberCount ?? 0), outstandingKobo: Number(row?.outstandingKobo ?? 0) };
}
