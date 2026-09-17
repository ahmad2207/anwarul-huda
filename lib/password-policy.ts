// Password policy for a member or administrator choosing their own
// password (never for the temporary password lib/credentials.ts
// generates, which is a random 10 character string from an unambiguous
// alphabet and needs no policy check of its own). Applied both to the
// forced first change and to any later change, since both go through
// the same schema (app/change-password/schema.ts).
//
// Deliberately narrow: a minimum length and a blocklist of passwords so
// common that trying them costs an attacker nothing, no more. No
// complexity rules (a forced mix of cases, digits and symbols measurably
// pushes people towards predictable patterns like "Password1!" rather
// than a genuinely stronger password, and is no longer recommended by
// NIST SP 800-63B), no forced rotation (the same guidance: rotation
// without a reason to suspect compromise mostly produces small,
// predictable variations of the last password, not a stronger one).

export const MIN_PASSWORD_LENGTH = 10;

// A password whose only merit is being ten characters is still worth
// nothing if it is one of the handful of strings that heads the top of
// every real world breach corpus: an attacker with a member number and
// one guess would spend it here first. Checked case-insensitively and
// with everyday separators (spaces, dashes, underscores, dots) removed,
// so "welcome-123" and "Welcome 123" are caught along with
// "welcome123". Deliberately not attempting leetspeak substitution
// (0 for o, @ for a and so on): that trades a small gain against exact
// forms like "P@ssw0rd" for a real risk of an unrelated password
// colliding with one after enough characters get rewritten, so the few
// iconic leetspeak forms worth catching are listed out below as their
// own literal entries instead. This list exists to catch the handful of
// choices an attacker always tries first, not to be an exhaustive
// breach corpus, and is maintained in-repo rather than pulled from an
// external package for exactly that narrower purpose.
const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  [
    "password",
    "password1",
    "password123",
    "password1234",
    "p@ssword",
    "p@ssw0rd",
    "p@ssword123",
    "12345678",
    "123456789",
    "1234567890",
    "1234567891",
    "12345678910",
    "qwertyuiop",
    "qwerty123",
    "1qaz2wsx",
    "1q2w3e4r",
    "zxcvbnm123",
    "letmein123",
    "letmeinnow",
    "welcome123",
    "welcome1234",
    "welc0me123",
    "admin12345",
    "adm1n123",
    "administrator",
    "iloveyou123",
    "trustno1234",
    "superman123",
    "princess123",
    "sunshine123",
    "dragon12345",
    "football123",
    "baseball123",
    "basketball1",
    "whatever123",
    "michaeljackson",
    "abcdefghij",
    "abcd1234567",
    "aaaaaaaaaa",
    "1111111111",
    "0000000000",
    "1212121212",
    "123123123123",
    "qazwsxedc12",
    "changeme123",
    "changeit123",
    "temppass123",
    "temporary123",
    "newpassword1",
    "newpassword123",
    "nopassword12",
  ].map(normalizeForComparison),
);

function normalizeForComparison(password: string): string {
  return password
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.]/g, "");
}

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(normalizeForComparison(password));
}
