import { z } from "zod";

export const voidPaymentSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason for voiding this payment.").max(500),
});
