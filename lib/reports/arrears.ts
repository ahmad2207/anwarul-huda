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

/**
 * Every active member with at least one contribution record not yet paid
 * in full, and how much they owe in total across every such record.
 * Comparing amountPaidKobo against amountDueKobo is a column-to-column
 * comparison Prisma's query builder cannot express, so this is raw SQL,
 * parameterised through Prisma.sql rather than string concatenation.
 */
export async function getArrearsReport(wingId?: string): Promise<ArrearsRow[]> {
  const wingFilter = wingId ? Prisma.sql`AND m.wing_id = ${wingId}` : Prisma.empty;

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
    WHERE cr.amount_paid_kobo < cr.amount_due_kobo
      AND m.status = 'ACTIVE'
      ${wingFilter}
    GROUP BY m.id, m.surname, m.first_name, m.member_number, w.id, w.name
    ORDER BY "outstandingKobo" DESC
  `);

  return rows.map((row) => ({
    ...row,
    outstandingKobo: Number(row.outstandingKobo),
    recordCount: Number(row.recordCount),
  }));
}
