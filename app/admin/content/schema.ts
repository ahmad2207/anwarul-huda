import { z } from "zod";
import { optionalField, optionalText, toStringList } from "@/lib/zod-helpers";

export const CONTENT_TYPES = ["SERMON", "WEEKLY_BOOK", "ARTICLE", "ANNOUNCEMENT"] as const;

export const contentSchema = z.object({
  type: z.enum(CONTENT_TYPES),
  title: z.string().trim().min(1, "Title is required").max(200),
  author: optionalText(200),
  summary: optionalText(1000),
  body: optionalText(20000),
  externalUrl: optionalField(z.string().trim().url("Enter a valid link")),
  // Stored lower case so a member's tag filter can match on an exact
  // string without needing a case insensitive array search, which
  // Postgres does not support directly.
  tags: z.array(z.string().trim().min(1)).transform((tags) => tags.map((tag) => tag.toLowerCase())),
  wingId: optionalText(50),
  deliveredOn: optionalField(z.coerce.date()),
  publishAt: optionalField(z.coerce.date()),
  isPublished: z.boolean(),
});

export function contentFormDataToRaw(formData: FormData) {
  return {
    type: formData.get("type"),
    title: formData.get("title"),
    author: formData.get("author"),
    summary: formData.get("summary"),
    body: formData.get("body"),
    externalUrl: formData.get("externalUrl"),
    tags: toStringList(formData.get("tags")),
    wingId: formData.get("wingId"),
    deliveredOn: formData.get("deliveredOn"),
    publishAt: formData.get("publishAt"),
    isPublished: formData.get("isPublished") === "on",
  };
}
