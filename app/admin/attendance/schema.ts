import { z } from "zod";
import { lagosDateTime, optionalLagosDateTime, optionalText } from "@/lib/zod-helpers";

export const createGatheringSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  type: z.enum(["JUMUAH", "TALEEM", "WING_MEETING", "GENERAL_MEETING", "PROGRAMME", "OTHER"]),
  wingId: optionalText(50),
  branchId: optionalText(50),
  startsAt: lagosDateTime("Start time is required", "Enter a valid start time"),
  endsAt: optionalLagosDateTime("Enter a valid end time"),
});

export function createGatheringFormDataToRaw(formData: FormData) {
  return {
    title: formData.get("title"),
    type: formData.get("type"),
    wingId: formData.get("wingId"),
    branchId: formData.get("branchId"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  };
}
