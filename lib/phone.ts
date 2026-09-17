// Normalises Nigerian phone numbers to E.164, for example "+2348012345678".
// Accepts the local formats members actually type in: 08012345678,
// 8012345678, 2348012345678, or already-correct E.164, with any mix of
// spaces, dashes and parentheses.

export class PhoneError extends Error {}

const COUNTRY_CODE = "234";
const NATIONAL_NUMBER_LENGTH = 10;

/**
 * Normalises a Nigerian phone number to E.164 (+234XXXXXXXXXX).
 * Throws PhoneError if the number cannot be confidently normalised.
 */
export function normalizeNigerianPhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new PhoneError("Phone number is empty");
  }

  // Strip everything except digits and a leading plus.
  const hasLeadingPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/[^0-9]/g, "");

  let national: string;

  if (hasLeadingPlus && digitsOnly.startsWith(COUNTRY_CODE)) {
    national = digitsOnly.slice(COUNTRY_CODE.length);
  } else if (digitsOnly.startsWith(COUNTRY_CODE) && digitsOnly.length === COUNTRY_CODE.length + NATIONAL_NUMBER_LENGTH) {
    national = digitsOnly.slice(COUNTRY_CODE.length);
  } else if (digitsOnly.startsWith("0")) {
    national = digitsOnly.slice(1);
  } else {
    national = digitsOnly;
  }

  if (national.length !== NATIONAL_NUMBER_LENGTH || !/^[789]\d{9}$/.test(national)) {
    throw new PhoneError(`"${input}" is not a recognisable Nigerian mobile number`);
  }

  return `+${COUNTRY_CODE}${national}`;
}

/** Returns true if the input normalises cleanly, without throwing. */
export function isValidNigerianPhone(input: string): boolean {
  try {
    normalizeNigerianPhone(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats an E.164 Nigerian number for display, for example "0801 234 5678".
 * A nominal roll import can genuinely have no phone on file at all, so null
 * is accepted and shown the same way MemberNumber shows an unissued number,
 * rather than every caller handling that case separately.
 */
export function formatNigerianPhoneForDisplay(e164: string | null): string {
  if (!e164) {
    return "Not on file";
  }
  if (!e164.startsWith(`+${COUNTRY_CODE}`)) {
    throw new PhoneError(`"${e164}" is not an E.164 Nigerian number`);
  }
  const national = e164.slice(`+${COUNTRY_CODE}`.length);
  const local = `0${national}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
