import { describe, expect, it } from "vitest";
import { formatReceiptText } from "./receipt-text";

describe("formatReceiptText", () => {
  const base = {
    receiptNumber: "RCT/2026/000123",
    memberName: "Bello Amina",
    memberNumber: "AHL/W/2026/0001",
    amountKobo: 50000,
    purpose: "Monthly dues (2026-09)",
    methodLabel: "Cash",
    reference: null,
    paidAt: new Date("2026-09-14T14:30:00.000Z"),
    collectedByLabel: "finance@ahl-league.test",
    status: "CONFIRMED" as const,
  };

  it("includes the key receipt details", () => {
    const text = formatReceiptText(base);
    expect(text).toContain("RCT/2026/000123");
    expect(text).toContain("Bello Amina (AHL/W/2026/0001)");
    expect(text).toContain("₦500.00");
    expect(text).toContain("Monthly dues (2026-09)");
    expect(text).toContain("Thank you.");
  });

  it("includes the reference when there is one", () => {
    const text = formatReceiptText({ ...base, methodLabel: "POS", reference: "POS-4471" });
    expect(text).toContain("POS (ref: POS-4471)");
  });

  it("omits the reference note when there is none", () => {
    const text = formatReceiptText(base);
    expect(text).not.toContain("ref:");
  });

  it("marks a voided receipt clearly instead of thanking the payer", () => {
    const text = formatReceiptText({ ...base, status: "VOIDED" });
    expect(text).toContain("THIS RECEIPT HAS BEEN VOIDED");
    expect(text).not.toContain("Thank you.");
  });
});
