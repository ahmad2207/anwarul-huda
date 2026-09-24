import { z } from "zod";
import { optionalField, optionalText } from "@/lib/zod-helpers";
import { parseLagosDateTimeLocal } from "@/lib/timezone";

// An announcement is a short notice, such as "No ta'leem this Saturday",
// shown on the member home under "Latest" and kept in the library as a
// record. No file or link: the message is the whole item.
export const announcementSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200, "Keep the title under 200 characters"),
  body: z.string().trim().min(1, "Enter the message").max(1000, "Keep the message under 1,000 characters"),
  wingId: optionalText(50),
  // Entered in Lagos time, so read as Lagos time rather than the server's.
  publishAt: optionalField(
    z.string().transform((value, ctx) => {
      const instant = parseLagosDateTimeLocal(value);
      if (!instant) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid date and time to publish" });
        return z.NEVER;
      }
      return instant;
    }),
  ),
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
