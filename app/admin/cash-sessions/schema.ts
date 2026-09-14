import { z } from "zod";
import { optionalText } from "@/lib/zod-helpers";

export const openSessionSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(200),
  openingFloat: z.string().trim().optional().default("0"),
});

export const closeSessionSchema = z.object({
  counted: z.string().trim().min(1, "Enter the counted cash amount"),
  varianceNote: optionalText(500),
});
