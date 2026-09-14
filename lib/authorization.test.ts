import { describe, expect, it } from "vitest";
import { canAccessWing, canEditMemberRecords, canViewAllWings, hasAnyRole } from "./authorization";

describe("canAccessWing", () => {
  it("allows a super admin into any wing, even with no wing assignments", () => {
    expect(canAccessWing({ roles: ["SUPER_ADMIN"], wingIds: [] }, "wing-1")).toBe(true);
  });

  it("allows a user assigned to that wing", () => {
    expect(canAccessWing({ roles: ["WING_ADMIN"], wingIds: ["wing-1"] }, "wing-1")).toBe(true);
  });

  it("denies a user assigned to a different wing", () => {
    expect(canAccessWing({ roles: ["WING_ADMIN"], wingIds: ["wing-2"] }, "wing-1")).toBe(false);
  });

  it("denies a user with no wing assignments at all", () => {
    expect(canAccessWing({ roles: ["WING_ADMIN"], wingIds: [] }, "wing-1")).toBe(false);
  });
});

describe("hasAnyRole", () => {
  it("allows a super admin regardless of the roles list", () => {
    expect(hasAnyRole({ roles: ["SUPER_ADMIN"] }, ["FINANCE_OFFICER"])).toBe(true);
  });

  it("allows a user holding one of the listed roles", () => {
    expect(hasAnyRole({ roles: ["WING_ADMIN", "MEMBER"] }, ["WING_ADMIN"])).toBe(true);
  });

  it("denies a user holding none of the listed roles", () => {
    expect(hasAnyRole({ roles: ["MEMBER"] }, ["WING_ADMIN", "FINANCE_OFFICER"])).toBe(false);
  });
});

describe("canViewAllWings", () => {
  it("allows a super admin", () => {
    expect(canViewAllWings({ roles: ["SUPER_ADMIN"] })).toBe(true);
  });

  it("allows a finance officer", () => {
    expect(canViewAllWings({ roles: ["FINANCE_OFFICER"] })).toBe(true);
  });

  it("denies a wing admin", () => {
    expect(canViewAllWings({ roles: ["WING_ADMIN"] })).toBe(false);
  });

  it("denies an attendance officer", () => {
    expect(canViewAllWings({ roles: ["ATTENDANCE_OFFICER"] })).toBe(false);
  });
});

describe("canEditMemberRecords", () => {
  it("allows a super admin for any wing", () => {
    expect(canEditMemberRecords({ roles: ["SUPER_ADMIN"], wingIds: [] }, "wing-1")).toBe(true);
  });

  it("allows a wing admin for their own wing", () => {
    expect(
      canEditMemberRecords({ roles: ["WING_ADMIN"], wingIds: ["wing-1"] }, "wing-1"),
    ).toBe(true);
  });

  it("denies a wing admin for a different wing", () => {
    expect(
      canEditMemberRecords({ roles: ["WING_ADMIN"], wingIds: ["wing-2"] }, "wing-1"),
    ).toBe(false);
  });

  it("denies a finance officer even though they can view every wing", () => {
    expect(
      canEditMemberRecords({ roles: ["FINANCE_OFFICER"], wingIds: [] }, "wing-1"),
    ).toBe(false);
  });

  it("denies an attendance officer assigned to that wing", () => {
    expect(
      canEditMemberRecords({ roles: ["ATTENDANCE_OFFICER"], wingIds: ["wing-1"] }, "wing-1"),
    ).toBe(false);
  });
});
