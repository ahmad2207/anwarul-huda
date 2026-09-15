/**
 * Turns a title into a URL friendly slug: lower case, non alphanumeric
 * runs collapsed to a single hyphen, no leading or trailing hyphen. A
 * title that produces nothing usable (all punctuation, for example)
 * falls back to a fixed word rather than an empty string, since
 * ContentItem.slug is unique and cannot be blank.
 */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}
