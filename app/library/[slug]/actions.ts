"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createSignedFileUrl } from "@/lib/storage";
import { canViewContent } from "@/lib/content/visibility";

// Short relative to a permanently reachable public bucket link, long
// enough to get through one sitting with a full sermon or a whole
// weekly book.
const FILE_URL_EXPIRY_SECONDS = 60 * 60;

export interface RequestFileUrlResult {
  url?: string;
  error?: string;
}

/**
 * Mints a fresh signed URL for a content item's file, re-checking access
 * from scratch rather than trusting that the item was safe to show on an
 * earlier page render: a link could be revisited after an item was
 * unpublished, rescheduled, or restricted to a different wing. Counts as
 * one download.
 */
export async function requestContentFileUrl(contentId: string): Promise<RequestFileUrlResult> {
  const user = await getCurrentUser();
  if (!user.memberId) {
    return { error: "This account is not linked to a member record." };
  }

  const [member, item] = await Promise.all([
    prisma.member.findUnique({ where: { id: user.memberId }, select: { wingId: true } }),
    prisma.contentItem.findUnique({ where: { id: contentId } }),
  ]);

  if (!item) {
    return { error: "This item no longer exists." };
  }
  if (!canViewContent(item, member?.wingId ?? null)) {
    return { error: "You do not have access to this item." };
  }
  if (!item.filePath) {
    return { error: "There is no file to open for this item." };
  }

  await prisma.contentItem.update({
    where: { id: item.id },
    data: { downloadCount: { increment: 1 } },
  });

  const url = await createSignedFileUrl(item.filePath, FILE_URL_EXPIRY_SECONDS);
  return { url };
}
