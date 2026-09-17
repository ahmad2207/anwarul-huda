import { randomInt } from "node:crypto";

// A temporary password an administrator reads aloud at the mosque, or
// over the phone, and the member copies by hand into their own phone.
// The alphabet leaves out exactly the characters SPEC-ADDENDUM-ACCOUNTS-
// AND-FACE.md names as the ones that get misheard or miscopied: 0 and O,
// 1 and I and lowercase l. Nothing else is removed, so this stays close
// to the full 62 character alphabet's entropy rather than trading it away
// for caution the spec did not ask for.
export const UNAMBIGUOUS_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const TEMPORARY_PASSWORD_LENGTH = 10;

/**
 * Generates a random temporary password from the unambiguous alphabet.
 * Uses node:crypto's randomInt, which draws from a cryptographically
 * secure source and rejects the biased remainder internally, rather than
 * Math.random() or a naive modulo, since this password is itself a
 * credential, not a display id like a member or receipt number.
 */
export function generateTemporaryPassword(): string {
  let password = "";
  for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i++) {
    password += UNAMBIGUOUS_ALPHABET[randomInt(UNAMBIGUOUS_ALPHABET.length)];
  }
  return password;
}
