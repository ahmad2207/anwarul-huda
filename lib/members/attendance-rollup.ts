import type { GatheringType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// The attendance rollup on the admin member view
// (MEMBER-HOME-AND-ADMIN-VIEW.md 2.2): for each gathering type, how many
// were held that this member could have attended, and how many of those
// they did. "Jumu'ah attended 31 of 44 held."

export interface AttendanceRollupRow {
  type: GatheringType;
  held: number;
  attended: number;
}

/**
 * Held counts gatherings of the member's own wing or open to all wings
 * (wing_id null) that started in [from, to) and have started by now, so
 * a scheduled one never counts as missed. Attended is a LEFT JOIN onto
 * that same set, so it can never exceed held; attendance at another
 * wing's gathering still shows in the log, just not here. The unique
 * (gathering_id, member_id) on attendance_records means at most one
 * joined row per gathering, so COUNT(ar.id) is a count of gatherings.
 *
 * One query, grouped in the database, rather than loading every
 * gathering in the period: the period can be years long.
 */
export async function getAttendanceRollup(
  member: { id: string; wingId: string },
  period: { from: Date; to: Date },
  now: Date = new Date(),
): Promise<AttendanceRollupRow[]> {
  const rows = await prisma.$queryRaw<{ type: GatheringType; held: bigint; attended: bigint }[]>`
    SELECT g.type, COUNT(*) AS held, COUNT(ar.id) AS attended
    FROM gatherings g
    LEFT JOIN attendance_records ar
      ON ar.gathering_id = g.id AND ar.member_id = ${member.id}
    WHERE (g.wing_id IS NULL OR g.wing_id = ${member.wingId})
      AND g.starts_at >= ${period.from}
      AND g.starts_at < ${period.to}
      AND g.starts_at <= ${now}
    GROUP BY g.type
    ORDER BY g.type
  `;

  return rows.map((row) => ({ type: row.type, held: Number(row.held), attended: Number(row.attended) }));
}
