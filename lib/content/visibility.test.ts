import { describe, expect, it } from "vitest";
import { canViewContent, isContentPublished } from "./visibility";

const NOW = new Date("2026-06-15T12:00:00Z");
const PAST = new Date("2026-06-01T00:00:00Z");
const FUTURE = new Date("2026-07-01T00:00:00Z");

describe("isContentPublished", () => {
  it("is false for a draft, even with no publish time set", () => {
    expect(isContentPublished({ isPublished: false, publishAt: null }, NOW)).toBe(false);
  });

  it("is true for a published item with no scheduled publish time", () => {
    expect(isContentPublished({ isPublished: true, publishAt: null }, NOW)).toBe(true);
  });

  it("stays hidden while its scheduled publish time is still in the future", () => {
    expect(isContentPublished({ isPublished: true, publishAt: FUTURE }, NOW)).toBe(false);
  });

  it("becomes visible once its scheduled publish time has passed", () => {
    expect(isContentPublished({ isPublished: true, publishAt: PAST }, NOW)).toBe(true);
  });

  it("is visible at the exact instant its publish time arrives", () => {
    expect(isContentPublished({ isPublished: true, publishAt: NOW }, NOW)).toBe(true);
  });
});

describe("canViewContent", () => {
  it("is hidden from everyone while unpublished, regardless of wing", () => {
    expect(canViewContent({ isPublished: false, publishAt: null, wingId: null }, "wing-1", NOW)).toBe(false);
  });

  it("is visible to any member when the item has no wing restriction", () => {
    expect(canViewContent({ isPublished: true, publishAt: null, wingId: null }, "wing-1", NOW)).toBe(true);
    expect(canViewContent({ isPublished: true, publishAt: null, wingId: null }, null, NOW)).toBe(true);
  });

  it("is visible to a member of the matching wing", () => {
    expect(canViewContent({ isPublished: true, publishAt: null, wingId: "wing-1" }, "wing-1", NOW)).toBe(true);
  });

  it("is hidden from a member of a different wing", () => {
    expect(canViewContent({ isPublished: true, publishAt: null, wingId: "wing-1" }, "wing-2", NOW)).toBe(false);
  });

  it("is hidden from a member with no wing on record when the item is wing restricted", () => {
    expect(canViewContent({ isPublished: true, publishAt: null, wingId: "wing-1" }, null, NOW)).toBe(false);
  });

  it("stays hidden from a matching wing member until the publish time arrives", () => {
    expect(canViewContent({ isPublished: true, publishAt: FUTURE, wingId: "wing-1" }, "wing-1", NOW)).toBe(false);
  });
});
