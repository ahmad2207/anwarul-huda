import { describe, expect, it } from "vitest";
import { computeAuditDiff } from "./diff";

describe("computeAuditDiff", () => {
  it("returns only the fields that actually changed", () => {
    const rows = computeAuditDiff({ status: "PENDING", surname: "Bello" }, { status: "ACTIVE", surname: "Bello" });
    expect(rows).toEqual([{ field: "status", before: "PENDING", after: "ACTIVE" }]);
  });

  it("treats every field as added when there is no before, a creation", () => {
    const rows = computeAuditDiff(null, { status: "ACTIVE" });
    expect(rows).toEqual([{ field: "status", before: undefined, after: "ACTIVE" }]);
  });

  it("treats every field as removed when there is no after, a deletion", () => {
    const rows = computeAuditDiff({ status: "ACTIVE" }, null);
    expect(rows).toEqual([{ field: "status", before: "ACTIVE", after: undefined }]);
  });

  it("returns nothing when both sides are identical", () => {
    const rows = computeAuditDiff({ a: 1, b: "two" }, { a: 1, b: "two" });
    expect(rows).toEqual([]);
  });

  it("is not fooled by key order, only by actual value differences", () => {
    const rows = computeAuditDiff({ a: 1, b: 2 }, { b: 2, a: 1 });
    expect(rows).toEqual([]);
  });

  it("sorts changed fields alphabetically, for a stable display order", () => {
    const rows = computeAuditDiff({ zeta: 1, alpha: 1 }, { zeta: 2, alpha: 2 });
    expect(rows.map((r) => r.field)).toEqual(["alpha", "zeta"]);
  });

  it("treats a non object snapshot (a bulk summary, not a full row) as empty rather than throwing", () => {
    const rows = computeAuditDiff("some summary string", { count: 5 });
    expect(rows).toEqual([{ field: "count", before: undefined, after: 5 }]);
  });
});
