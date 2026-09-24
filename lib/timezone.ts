// Dates are stored in UTC everywhere in this system, but a few things are
// business identifiers tied to the organisation's own calendar rather than
// the server's, for example the year in a member number. Use these helpers
// for that, instead of reading the year off a UTC instant directly.

export const LAGOS_TIME_ZONE = "Africa/Lagos";

/**
 * Returns the calendar year for a UTC instant, as seen in Africa/Lagos.
 * Lagos is UTC+1, so relying on a server's UTC year for a "this year"
 * business identifier can be wrong for part of the day.
 */
export function getLagosYear(instant: Date = new Date()): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: LAGOS_TIME_ZONE,
    year: "numeric",
  }).format(instant);
  return Number(formatted);
}

export interface LagosDateParts {
  year: number;
  month: number;
  day: number;
}

/** Returns the calendar year, month (1-12) and day for a UTC instant, as seen in Africa/Lagos. */
export function getLagosDateParts(instant: Date = new Date()): LagosDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LAGOS_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * The UTC instant at which it becomes midnight on the given Lagos calendar
 * date. Lagos is UTC+1 with no daylight saving, so that instant is always
 * 23:00 UTC the day before. Month and day can overflow (month 13, or a
 * day past the end of the month) and roll over correctly, the same way
 * `Date.UTC` itself does, which period boundary math below relies on.
 */
export function lagosMidnightUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, -1, 0, 0, 0));
}

/**
 * Reads the "YYYY-MM-DDTHH:mm" value of a datetime-local input as a Lagos
 * wall clock time and returns the UTC instant it names. `new Date()` on
 * the same string would read it in the server's own zone instead, which
 * on a UTC server puts every time an hour late. Returns null for anything
 * that is not that exact shape or not a real calendar time.
 */
export function parseLagosDateTimeLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day, hour - 1, minute));
  // Round trip through Lagos to reject a date that rolled over, such as 31 February.
  const parts = getLagosDateParts(instant);
  if (parts.year !== year || parts.month !== month || parts.day !== day || hour > 23 || minute > 59) {
    return null;
  }
  return instant;
}
