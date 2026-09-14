import { z } from "zod";
import { optionalText } from "@/lib/zod-helpers";

export const planSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: optionalText(500),
  // Naira, as a string straight off the form; converted to kobo in the
  // action, where a MoneyError becomes a clear field message instead of
  // an unhandled exception.
  amount: z.string().trim().min(1, "Amount is required"),
  frequency: z.enum(["ONE_OFF", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"]),
  wingId: optionalText(50),
  isActive: z.boolean(),
});

export type PlanInput = z.infer<typeof planSchema>;

export function planFormDataToRaw(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    frequency: formData.get("frequency"),
    wingId: formData.get("wingId"),
    isActive: formData.get("isActive") === "on",
  };
}
