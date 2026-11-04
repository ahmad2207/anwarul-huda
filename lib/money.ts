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

/** The largest amount a kobo column (Postgres integer) can hold. */
export const MAX_KOBO = 2_147_483_647;

/**
 * Parses a Naira amount as typed into a form ("1250", "1,250.50") straight
 * to kobo, digit by digit, with no float involved. Only plain decimal
 * input is accepted: "1e3", "0x10", negatives and more than two decimal
 * places are refused rather than quietly read as some other number.
 */
export function parseNairaText(text: string, options: { allowZero?: boolean } = {}): number {
  const cleaned = text.trim().replace(/,/g, "");
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) {
    throw new MoneyError("Enter the amount in Naira, for example 1250 or 1250.50.");
  }
  const kobo = Number(match[1]) * KOBO_PER_NAIRA + Number((match[2] ?? "").padEnd(2, "0"));
  if (kobo > MAX_KOBO) {
    throw new MoneyError("That amount is too large. Check it and try again.");
  }
  if (kobo === 0 && !options.allowZero) {
    throw new MoneyError("Enter an amount greater than zero.");
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
 * formatNaira(125000) returns "₦1,250.00", matching CLAUDE.md and
 * DESIGN.md, which both specify the Naira sign, never the letter N.
 */
export function formatNaira(kobo: number): string {
  assertInteger(kobo, "kobo");
  const symbol = "₦";
  const negative = kobo < 0;
  const absoluteNaira = koboToNaira(Math.abs(kobo));
  const formatted = absoluteNaira.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${negative ? "-" : ""}${symbol}${formatted}`;
}
