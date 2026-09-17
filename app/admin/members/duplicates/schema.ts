import { z } from "zod";

export const dismissDuplicateFlagSchema = z.object({
  flagId: z.string().min(1),
});
