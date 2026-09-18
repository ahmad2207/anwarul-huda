/**
 * Whole years between a date of birth and another date, defaulting to
 * now. Used for the face enrolment age gate (SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md
 * 4.7: nobody under 18 without a separate committee decision on guardian
 * consent), so this counts a birthday exactly, not by calendar year
 * subtraction alone, which would say 18 up to five months early.
 */
export function ageInYears(dateOfBirth: Date, asOf: Date = new Date()): number {
  let age = asOf.getFullYear() - dateOfBirth.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > dateOfBirth.getMonth() ||
    (asOf.getMonth() === dateOfBirth.getMonth() && asOf.getDate() >= dateOfBirth.getDate());
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}
