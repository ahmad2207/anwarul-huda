import { z } from "zod";
import { optionalText } from "@/lib/zod-helpers";

export const paymentSchema = z
  .object({
    memberId: z.string().min(1, "Choose a member"),
    targetType: z.enum(["plan", "fund"], { message: "Choose a plan or a fund" }),
    targetId: z.string().min(1, "Choose a plan or a fund"),
    amount: z.string().trim().min(1, "Amount is required"),
    method: z.enum(["CASH", "POS", "BANK_TRANSFER"]),
    reference: optionalText(100),
    narration: optionalText(500),
  })
  .refine((data) => data.method === "CASH" || Boolean(data.reference), {
    message: "Enter a reference for POS or bank transfer",
    path: ["reference"],
  });

export function paymentFormDataToRaw(formData: FormData) {
  return {
    memberId: formData.get("memberId"),
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    reference: formData.get("reference"),
    narration: formData.get("narration"),
  };
}
