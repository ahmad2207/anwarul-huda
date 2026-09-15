// Whether a content item is visible to a member: published, its
// scheduled publish time (if any) has passed, and it is not restricted
// to a wing other than the member's own. Kept pure and framework free so
// the phase's own accept criterion, that a scheduled item stays hidden
// until its publish time, can be proven directly against a chosen instant
// rather than the real clock.

export interface ContentVisibilityInput {
  isPublished: boolean;
  publishAt: Date | null;
  wingId: string | null;
}

/** True once an item is published and, if it has a publish time, that time has passed. */
export function isContentPublished(
  item: Pick<ContentVisibilityInput, "isPublished" | "publishAt">,
  now: Date = new Date(),
): boolean {
  if (!item.isPublished) return false;
  if (item.publishAt && item.publishAt.getTime() > now.getTime()) return false;
  return true;
}

/**
 * True when a member can see this item at all: published and in time,
 * and either open to all wings (wingId null) or matching the member's
 * own wing. A member with no wing on record (memberWingId null) can
 * still see all-wings content, but never a wing-restricted item.
 */
export function canViewContent(
  item: ContentVisibilityInput,
  memberWingId: string | null,
  now: Date = new Date(),
): boolean {
  if (!isContentPublished(item, now)) return false;
  if (item.wingId && item.wingId !== memberWingId) return false;
  return true;
}
