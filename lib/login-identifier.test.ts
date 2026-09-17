import { describe, expect, it } from "vitest";
import { classifyLoginIdentifier } from "./login-identifier";

describe("classifyLoginIdentifier", () => {
  it("recognises a member number regardless of punctuation or case", () => {
    expect(classifyLoginIdentifier("AHL/M/2026/0113")).toEqual({
      kind: "memberNumber",
      canonical: "AHL/M/2026/0113",
    });
    expect(classifyLoginIdentifier("ahl m 2026 0113")).toEqual({
      kind: "memberNumber",
      canonical: "AHL/M/2026/0113",
    });
    expect(classifyLoginIdentifier("AHLM20260113")).toEqual({
      kind: "memberNumber",
      canonical: "AHL/M/2026/0113",
    });
  });

  it("recognises an email address", () => {
    expect(classifyLoginIdentifier("Admin@Example.com")).toEqual({
      kind: "email",
      canonical: "admin@example.com",
    });
  });

  it("recognises a Nigerian phone number in local format", () => {
    expect(classifyLoginIdentifier("08012345678")).toEqual({
      kind: "phone",
      canonical: "+2348012345678",
    });
  });

  it("falls back to unrecognised for anything else", () => {
    expect(classifyLoginIdentifier("not an identifier")).toEqual({
      kind: "unrecognised",
      canonical: "not an identifier",
    });
  });
});
