import { describe, expect, it } from "vitest";
import { groupCollections } from "./collections";
import type { CollectionsPayment } from "./collections";

function payment(overrides: Partial<CollectionsPayment>): CollectionsPayment {
  return {
    amountKobo: 50000,
    paidAt: new Date("2026-09-14T12:00:00.000Z"),
    planId: "plan-1",
    planName: "Monthly dues",
    fundId: null,
    fundName: null,
    wingId: "wing-1",
    wingName: "Men's wing",
    collectedById: "officer-1",
    collectedByLabel: "finance@ahl-league.test",
    method: "CASH",
    ...overrides,
  };
}

describe("groupCollections", () => {
  it("sums amounts within the same group and counts each payment once", () => {
    const rows = groupCollections(
      [payment({ amountKobo: 50000 }), payment({ amountKobo: 30000 })],
      "plan",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].totalKobo).toBe(80000);
    expect(rows[0].count).toBe(2);
  });

  it("groups by period using the Lagos calendar month", () => {
    const rows = groupCollections(
      [
        payment({ paidAt: new Date("2026-09-30T23:30:00.000Z") }), // late Sept 30 UTC, already Oct 1 in Lagos
        payment({ paidAt: new Date("2026-09-14T12:00:00.000Z") }),
      ],
      "period",
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.label).sort()).toEqual(["2026-09", "2026-10"]);
  });

  it("groups by plan, separating fund donations and general payments", () => {
    const rows = groupCollections(
      [
        payment({ planId: "plan-1", planName: "Monthly dues" }),
        payment({ planId: null, fundId: "fund-1", fundName: "Zakat fund" }),
        payment({ planId: null, fundId: null }),
      ],
      "plan",
    );
    expect(rows.map((r) => r.label).sort()).toEqual(["Fund: Zakat fund", "General", "Monthly dues"]);
  });

  it("groups by wing", () => {
    const rows = groupCollections(
      [
        payment({ wingId: "w1", wingName: "Men's wing" }),
        payment({ wingId: "w2", wingName: "Women's wing" }),
        payment({ wingId: "w1", wingName: "Men's wing" }),
      ],
      "wing",
    );
    const menWing = rows.find((r) => r.label === "Men's wing");
    expect(menWing?.count).toBe(2);
  });

  it("groups by officer", () => {
    const rows = groupCollections(
      [
        payment({ collectedById: "o1", collectedByLabel: "a@test.com" }),
        payment({ collectedById: "o2", collectedByLabel: "b@test.com" }),
      ],
      "officer",
    );
    expect(rows).toHaveLength(2);
  });

  it("groups by method with a readable label", () => {
    const rows = groupCollections(
      [payment({ method: "CASH" }), payment({ method: "POS" }), payment({ method: "BANK_TRANSFER" })],
      "method",
    );
    expect(rows.map((r) => r.label).sort()).toEqual(["Bank transfer", "Cash", "POS"]);
  });

  it("returns an empty list for no payments", () => {
    expect(groupCollections([], "wing")).toEqual([]);
  });

  it("sorts groups from highest total to lowest", () => {
    const rows = groupCollections(
      [
        payment({ wingId: "w1", wingName: "Small", amountKobo: 10000 }),
        payment({ wingId: "w2", wingName: "Big", amountKobo: 90000 }),
      ],
      "wing",
    );
    expect(rows[0].label).toBe("Big");
    expect(rows[1].label).toBe("Small");
  });
});
