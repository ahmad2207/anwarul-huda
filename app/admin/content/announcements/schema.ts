import { z } from "zod";
import { optionalLagosDateTime, optionalText } from "@/lib/zod-helpers";

// An announcement is a short notice, such as "No ta'leem this Saturday",
// shown on the member home under "Latest" and kept in the library as a
// record. No file or link: the message is the whole item.
export const announcementSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200, "Keep the title under 200 characters"),
  body: z.string().trim().min(1, "Enter the message").max(1000, "Keep the message under 1,000 characters"),
  wingId: optionalText(50),
  publishAt: optionalLagosDateTime("Enter a valid date and time to publish"),
  isPublished: z.boolean(),
});

export function announcementFormDataToRaw(formData: FormData) {
  return {
    title: formData.get("title"),
    body: formData.get("body"),
    wingId: formData.get("wingId"),
    publishAt: formData.get("publishAt"),
    isPublished: formData.get("isPublished") === "on",
  };
}
