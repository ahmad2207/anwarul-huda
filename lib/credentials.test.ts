import { describe, expect, it } from "vitest";
import { TEMPORARY_PASSWORD_LENGTH, UNAMBIGUOUS_ALPHABET, generateTemporaryPassword } from "./credentials";

describe("generateTemporaryPassword", () => {
  it("generates a password of the expected length", () => {
    expect(generateTemporaryPassword()).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
  });

  it("only uses characters from the unambiguous alphabet", () => {
    const password = generateTemporaryPassword();
    for (const char of password) {
      expect(UNAMBIGUOUS_ALPHABET).toContain(char);
    }
  });

  it("never contains a character that is easily misheard or miscopied", () => {
    const password = generateTemporaryPassword();
    for (const excluded of ["0", "O", "l", "1", "I"]) {
      expect(password).not.toContain(excluded);
    }
  });

  it("is not the same across repeated calls", () => {
    const passwords = new Set(Array.from({ length: 30 }, () => generateTemporaryPassword()));
    expect(passwords.size).toBeGreaterThan(1);
  });
});
