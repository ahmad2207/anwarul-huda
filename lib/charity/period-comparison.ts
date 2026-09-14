export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * The immediately preceding period of the same length, for the
 * dashboard's period comparison (docs/SPEC.md 2.5, Phase 4 item 6). A
 * calendar month back is not always the same number of days, so this
 * mirrors the selected period's actual duration rather than assuming a
 * month, a quarter or a year.
 */
export function getPreviousPeriod(period: DateRange): DateRange {
  const durationMs = period.to.getTime() - period.from.getTime();
  const to = new Date(period.from.getTime() - 1);
  const from = new Date(to.getTime() - durationMs);
  return { from, to };
}
