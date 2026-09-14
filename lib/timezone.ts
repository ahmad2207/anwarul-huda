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
