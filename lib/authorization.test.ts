import { describe, expect, it } from "vitest";
import {
  canAccessWing,
  canEditMemberRecords,
  canEnrolMemberFace,
  canReviewFaceMatch,
  canViewAllWings,
  canViewMember,
  canViewCharityHistory,
  hasAnyRole,
} from "./authorization";

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

describe("canViewCharityHistory", () => {
  it("allows a super admin and a charity officer", () => {
    expect(canViewCharityHistory({ roles: ["SUPER_ADMIN"] })).toBe(true);
    expect(canViewCharityHistory({ roles: ["CHARITY_OFFICER"] })).toBe(true);
  });

  it("denies every other role that can open a member record", () => {
    for (const role of ["WING_ADMIN", "FINANCE_OFFICER", "ATTENDANCE_OFFICER", "CONTENT_EDITOR", "MEMBER"] as const) {
      expect(canViewCharityHistory({ roles: [role] })).toBe(false);
    }
  });

  it("allows a wing admin who also holds the charity officer role", () => {
    expect(canViewCharityHistory({ roles: ["WING_ADMIN", "CHARITY_OFFICER"] })).toBe(true);
  });
});

describe("canViewMember", () => {
  it("lets a super admin with no wing assignment view a member in any wing", () => {
    expect(canViewMember({ roles: ["SUPER_ADMIN"], wingIds: [] }, "wing-1")).toBe(true);
    expect(canViewMember({ roles: ["SUPER_ADMIN"], wingIds: [] }, "wing-2")).toBe(true);
  });

  it("lets a finance officer view any wing, read only being enforced elsewhere", () => {
    expect(canViewMember({ roles: ["FINANCE_OFFICER"], wingIds: [] }, "wing-1")).toBe(true);
  });

  it("confines a wing admin and an attendance officer to their own wings", () => {
    expect(canViewMember({ roles: ["WING_ADMIN"], wingIds: ["wing-1"] }, "wing-1")).toBe(true);
    expect(canViewMember({ roles: ["WING_ADMIN"], wingIds: ["wing-1"] }, "wing-2")).toBe(false);
    expect(canViewMember({ roles: ["ATTENDANCE_OFFICER"], wingIds: ["wing-2"] }, "wing-1")).toBe(false);
  });

  it("gives charity officers, content editors and members no view of the register", () => {
    for (const role of ["CHARITY_OFFICER", "CONTENT_EDITOR", "MEMBER"] as const) {
      expect(canViewMember({ roles: [role], wingIds: ["wing-1"] }, "wing-1")).toBe(false);
    }
  });
});

describe("canReviewFaceMatch", () => {
  it("lets a super admin with no wing review any pair", () => {
    expect(canReviewFaceMatch({ roles: ["SUPER_ADMIN"], wingIds: [] }, "wing-1", "wing-2")).toBe(true);
  });

  it("lets an attendance officer review a pair wholly within their wings", () => {
    expect(canReviewFaceMatch({ roles: ["ATTENDANCE_OFFICER"], wingIds: ["wing-1"] }, "wing-1", "wing-1")).toBe(true);
    expect(
      canReviewFaceMatch({ roles: ["ATTENDANCE_OFFICER"], wingIds: ["wing-1", "wing-2"] }, "wing-1", "wing-2"),
    ).toBe(true);
  });

  it("keeps a pair spanning another wing from an attendance officer", () => {
    expect(canReviewFaceMatch({ roles: ["ATTENDANCE_OFFICER"], wingIds: ["wing-1"] }, "wing-1", "wing-2")).toBe(false);
  });

  it("gives other roles no access, even in their own wing", () => {
    for (const role of ["WING_ADMIN", "FINANCE_OFFICER", "CHARITY_OFFICER", "CONTENT_EDITOR", "MEMBER"] as const) {
      expect(canReviewFaceMatch({ roles: [role], wingIds: ["wing-1"] }, "wing-1", "wing-1")).toBe(false);
    }
  });
});

describe("canEnrolMemberFace", () => {
  it("lets a super admin enrol anyone", () => {
    expect(canEnrolMemberFace({ roles: ["SUPER_ADMIN"], wingIds: [] }, "wing-1")).toBe(true);
  });

  it("lets an attendance officer or wing admin enrol a member in their own wing only", () => {
    expect(canEnrolMemberFace({ roles: ["ATTENDANCE_OFFICER"], wingIds: ["wing-1"] }, "wing-1")).toBe(true);
    expect(canEnrolMemberFace({ roles: ["WING_ADMIN"], wingIds: ["wing-1"] }, "wing-1")).toBe(true);
    expect(canEnrolMemberFace({ roles: ["ATTENDANCE_OFFICER"], wingIds: ["wing-1"] }, "wing-2")).toBe(false);
  });

  it("does not let a finance officer enrol, though they can view every member", () => {
    expect(canEnrolMemberFace({ roles: ["FINANCE_OFFICER"], wingIds: [] }, "wing-1")).toBe(false);
  });
});
