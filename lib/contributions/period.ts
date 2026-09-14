import type { Frequency } from "@prisma/client";
import { getLagosDateParts, lagosMidnightUtc } from "@/lib/timezone";

export interface Period {
  /** "2026-09", "2026-Q3", "2026", "2026-W37", or "ONE-OFF". */
  periodLabel: string;
  /** Inclusive start, the Lagos-local midnight this period begins at. */
  periodStart: Date;
  /** Exclusive end, the Lagos-local midnight the next period begins at. */
  periodEnd: Date;
}

/**
 * Computes the period a contribution record belongs to, for a given
 * frequency and a reference instant, using the Lagos calendar day rather
 * than the server's UTC day. The period label is also the natural key
 * that keeps record generation idempotent: running it twice for the same
 * reference date always computes the same label, and the unique
 * constraint on (memberId, planId, periodLabel) does the rest.
 */
export function computePeriod(frequency: Frequency, referenceDate: Date = new Date()): Period {
  const { year, month, day } = getLagosDateParts(referenceDate);

  switch (frequency) {
    case "MONTHLY":
      return {
        periodLabel: `${year}-${String(month).padStart(2, "0")}`,
        periodStart: lagosMidnightUtc(year, month, 1),
        periodEnd: lagosMidnightUtc(year, month + 1, 1),
      };

    case "QUARTERLY": {
      const quarter = Math.floor((month - 1) / 3) + 1;
      const startMonth = (quarter - 1) * 3 + 1;
      return {
        periodLabel: `${year}-Q${quarter}`,
        periodStart: lagosMidnightUtc(year, startMonth, 1),
        periodEnd: lagosMidnightUtc(year, startMonth + 3, 1),
      };
    }

    case "ANNUAL":
      return {
        periodLabel: `${year}`,
        periodStart: lagosMidnightUtc(year, 1, 1),
        periodEnd: lagosMidnightUtc(year + 1, 1, 1),
      };

    case "WEEKLY": {
      const week = isoWeekInfo(year, month, day);
      return {
        periodLabel: `${week.isoYear}-W${String(week.isoWeek).padStart(2, "0")}`,
        periodStart: lagosMidnightUtc(week.weekStartYear, week.weekStartMonth, week.weekStartDay),
        periodEnd: lagosMidnightUtc(week.weekStartYear, week.weekStartMonth, week.weekStartDay + 7),
      };
    }

    case "ONE_OFF":
      // A one-off plan has no repeating period: at most one record per
      // member ever. The label is fixed, rather than date-based, so
      // generating it again (on any date) still lands on the same
      // record instead of creating a new one each time.
      return {
        periodLabel: "ONE-OFF",
        periodStart: lagosMidnightUtc(year, month, day),
        periodEnd: lagosMidnightUtc(year, month, day + 1),
      };
  }
}

/**
 * The standard ISO 8601 week algorithm (weeks start Monday, week 1 is the
 * week containing the year's first Thursday), run against a plain
 * calendar date rather than a real instant: the year/month/day is already
 * the Lagos calendar day, and ISO week numbers are a calendar concept,
 * not a timezone-instant one.
 */
function isoWeekInfo(
  year: number,
  month: number,
  day: number,
): { isoYear: number; isoWeek: number; weekStartYear: number; weekStartMonth: number; weekStartDay: number } {
  const date = new Date(Date.UTC(year, month - 1, day));
  const mondayIndexedDay = (date.getUTCDay() + 6) % 7; // Monday = 0 .. Sunday = 6

  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - mondayIndexedDay);

  const thursday = new Date(date);
  thursday.setUTCDate(thursday.getUTCDate() - mondayIndexedDay + 3);
  const isoYear = thursday.getUTCFullYear();

  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursdayDayIndex = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayIndex + 3);

  const isoWeek = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000));

  return {
    isoYear,
    isoWeek,
    weekStartYear: monday.getUTCFullYear(),
    weekStartMonth: monday.getUTCMonth() + 1,
    weekStartDay: monday.getUTCDate(),
  };
}
