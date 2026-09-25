import type { Fund } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLagosDateParts, lagosMidnightUtc, parseLagosDayEnd, parseLagosDayStart } from "@/lib/timezone";
import { getFundBalance } from "./fund-balance";
import type { FundBalance, FundBalancePeriod } from "./fund-balance";
import { getZakatBreakdown } from "./zakat-breakdown";
import type { ZakatCategoryBreakdown } from "./zakat-breakdown";
import { getPreviousPeriod } from "./period-comparison";
import type { DateRange } from "./period-comparison";

/** Defaults the dashboard, its export and its printable view all share: the current Lagos calendar month. */
function currentMonthRange(): DateRange {
  const { year, month } = getLagosDateParts();
  return {
    from: lagosMidnightUtc(year, month, 1),
    to: new Date(lagosMidnightUtc(year, month + 1, 1).getTime() - 1),
  };
}

/** Resolves the period from ?from=&to= query params, falling back to the current month for either one that is missing. */
export function resolveDashboardPeriod(params: Record<string, string | string[] | undefined>): DateRange {
  const defaults = currentMonthRange();
  // Lagos days, the whole of the last one included: the same shape as the
  // default month above.
  const from = parseLagosDayStart(params.from) ?? defaults.from;
  const to = parseLagosDayEnd(params.to) ?? defaults.to;
  return { from, to };
}

export interface FundDashboardRow {
  fund: Fund;
  current: FundBalance;
  previous: FundBalance;
  zakatBreakdown: ZakatCategoryBreakdown[];
}

/** Shared by the dashboard page, its CSV export and its printable view, so all three always agree. */
export async function getCharityDashboardData(period: { from: Date; to: Date }): Promise<FundDashboardRow[]> {
  const previousPeriod = getPreviousPeriod(period);
  const funds = await prisma.fund.findMany({ orderBy: { name: "asc" } });

  return Promise.all(
    funds.map(async (fund) => {
      const [current, previous] = await Promise.all([
        getFundBalance(fund.id, period as FundBalancePeriod),
        getFundBalance(fund.id, previousPeriod as FundBalancePeriod),
      ]);
      const zakatBreakdown = fund.type === "ZAKAT" ? await getZakatBreakdown(fund.id, period) : [];
      return { fund, current, previous, zakatBreakdown };
    }),
  );
}
