import { z } from "zod";
import { optionalText } from "@/lib/zod-helpers";

export const disbursementSchema = z.object({
  fundId: z.string().min(1, "Choose a fund"),
  caseId: z.string().min(1, "Choose a case"),
  amount: z.string().trim().min(1, "Amount is required"),
  method: z.enum(["CASH", "POS", "BANK_TRANSFER"]),
  narration: optionalText(500),
});
