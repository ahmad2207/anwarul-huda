// Money is always an integer number of kobo. Never use a float for a Naira
// amount anywhere in this codebase. One Naira is one hundred kobo.

const KOBO_PER_NAIRA = 100;

export class MoneyError extends Error {}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of kobo, got ${value}`);
  }
}

/** Adds two kobo amounts. */
export function addKobo(a: number, b: number): number {
  assertInteger(a, "a");
  assertInteger(b, "b");
  return a + b;
}

/** Subtracts b kobo from a kobo. */
export function subtractKobo(a: number, b: number): number {
  assertInteger(a, "a");
  assertInteger(b, "b");
  return a - b;
}

/** Sums a list of kobo amounts. Returns 0 for an empty list. */
export function sumKobo(amounts: number[]): number {
  return amounts.reduce((total, amount) => addKobo(total, amount), 0);
}

/** Converts a whole Naira amount to kobo. Rejects fractional Naira input. */
export function nairaToKobo(naira: number): number {
  if (!Number.isFinite(naira)) {
    throw new MoneyError(`Naira amount must be a finite number, got ${naira}`);
  }
  const kobo = Math.round(naira * KOBO_PER_NAIRA);
  if (Math.abs(kobo - naira * KOBO_PER_NAIRA) > 1e-6) {
    throw new MoneyError(`Naira amount ${naira} does not convert cleanly to kobo`);
  }
  return kobo;
}

/** Converts kobo to a Naira number, for calculations that need it. Display should use formatNaira instead. */
export function koboToNaira(kobo: number): number {
  assertInteger(kobo, "kobo");
  return kobo / KOBO_PER_NAIRA;
}

/**
 * Formats a kobo amount as Nigerian Naira for display, for example
 * formatNaira(125000) returns "N1,250.00".
 *
 * Uses the ASCII Naira sign by default so it renders correctly everywhere.
 * Pass { symbol: "unicode" } for the Naira currency symbol where the font
 * and encoding are known to support it.
 */
export function formatNaira(
  kobo: number,
  options: { symbol?: "ascii" | "unicode" } = {},
): string {
  assertInteger(kobo, "kobo");
  const symbol = options.symbol === "unicode" ? "₦" : "N";
  const negative = kobo < 0;
  const absoluteNaira = koboToNaira(Math.abs(kobo));
  const formatted = absoluteNaira.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${negative ? "-" : ""}${symbol}${formatted}`;
}
