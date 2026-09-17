import { formatNaira } from "@/lib/money";

export interface ReceiptData {
  receiptNumber: string;
  memberName: string;
  memberNumber: string | null;
  amountKobo: number;
  purpose: string;
  methodLabel: string;
  reference: string | null;
  paidAt: Date;
  collectedByLabel: string;
  status: "CONFIRMED" | "VOIDED";
}

/**
 * A plain text receipt, suitable for pasting into WhatsApp or an SMS. No
 * automation sends it anywhere, an officer copies and pastes it manually
 * (see docs/SPEC.md 2.4 and the "not in version 1" list).
 */
export function formatReceiptText(data: ReceiptData): string {
  const lines = [
    "Anwaru-l-Huda League of Nigeria",
    `Receipt ${data.receiptNumber}`,
    "----------------------------------------",
    `Member: ${data.memberName}${data.memberNumber ? ` (${data.memberNumber})` : ""}`,
    `Amount: ${formatNaira(data.amountKobo)}`,
    `For: ${data.purpose}`,
    `Method: ${data.methodLabel}${data.reference ? ` (ref: ${data.reference})` : ""}`,
    `Date: ${data.paidAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}`,
    `Collected by: ${data.collectedByLabel}`,
  ];

  if (data.status === "VOIDED") {
    lines.push("----------------------------------------", "THIS RECEIPT HAS BEEN VOIDED");
  } else {
    lines.push("----------------------------------------", "Thank you.");
  }

  return lines.join("\n");
}
