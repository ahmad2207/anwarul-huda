import { describe, expect, it } from "vitest";
import { isCommonPassword } from "./password-policy";

describe("isCommonPassword", () => {
  it("flags a well known common password", () => {
    expect(isCommonPassword("password123")).toBe(true);
  });

  it("flags it regardless of case", () => {
    expect(isCommonPassword("PaSSword123")).toBe(true);
  });

  it("flags it with an everyday separator inserted", () => {
    expect(isCommonPassword("welcome-123")).toBe(true);
    expect(isCommonPassword("welcome_123")).toBe(true);
    expect(isCommonPassword("Welcome 123")).toBe(true);
  });

  it("flags a few iconic leetspeak forms listed explicitly, without generalising the substitution", () => {
    expect(isCommonPassword("P@ssw0rd")).toBe(true);
  });

  it("does not flag an unrelated, unusual password", () => {
    expect(isCommonPassword("kx9mQzP4vRtL")).toBe(false);
  });

  it("does not flag a genuine passphrase that merely shares a common word", () => {
    expect(isCommonPassword("theSunshineAfterRain2026")).toBe(false);
  });
});
