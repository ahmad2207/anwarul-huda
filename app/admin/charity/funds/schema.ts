import { z } from "zod";
import { optionalText } from "@/lib/zod-helpers";

export const fundSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  type: z.enum(["ZAKAT", "SADAQAH", "WAQF", "GENERAL", "APPEAL"]),
  description: optionalText(500),
  isActive: z.boolean(),
});

export function fundFormDataToRaw(formData: FormData) {
  return {
    name: formData.get("name"),
    type: formData.get("type"),
    description: formData.get("description"),
    isActive: formData.get("isActive") === "on",
  };
}
