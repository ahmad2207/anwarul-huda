import type { GatheringType } from "@prisma/client";
import { getLagosDateParts, lagosMidnightUtc, parseLagosDate, toLagosDateInputValue } from "@/lib/timezone";
import { GATHERING_TYPE_LABELS } from "./labels";

export interface AttendanceFilter {
  /** Lagos midnight at the start of the first day. */
  from: Date;
  /** Lagos midnight at the start of the day after the last day, so the last day is included in full. */
  to: Date;
  /** Only narrows the log. The rollup is already by type. */
  type?: GatheringType;
  /** The values to put back into the filter form and carry through links. */
  fromValue: string;
  toValue: string;
}

/**
 * The attendance tab's period and type, read from the query string.
 * Defaults to this Lagos calendar year up to and including today. A
 * missing or malformed date falls back to its default rather than
 * erroring, and a range given backwards is swapped.
 */
export function parseAttendanceFilter(
  params: { from?: string; to?: string; type?: string },
  now: Date = new Date(),
): AttendanceFilter {
  const today = getLagosDateParts(now);
  const defaultFrom = lagosMidnightUtc(today.year, 1, 1);
  const defaultLastDay = lagosMidnightUtc(today.year, today.month, today.day);

  let firstDay = (params.from && parseLagosDate(params.from)) || defaultFrom;
  let lastDay = (params.to && parseLagosDate(params.to)) || defaultLastDay;
  if (firstDay > lastDay) {
    [firstDay, lastDay] = [lastDay, firstDay];
  }

  const last = getLagosDateParts(lastDay);
  const type =
    params.type && params.type in GATHERING_TYPE_LABELS ? (params.type as GatheringType) : undefined;

  return {
    from: firstDay,
    to: lagosMidnightUtc(last.year, last.month, last.day + 1),
    type,
    fromValue: toLagosDateInputValue(firstDay),
    toValue: toLagosDateInputValue(lastDay),
  };
}
