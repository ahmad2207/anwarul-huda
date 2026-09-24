"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { slugify } from "@/lib/content/slug";
import { announcementFormDataToRaw, announcementSchema } from "./schema";

export interface AnnouncementActionState {
  error?: string;
  success?: boolean;
}

export async function createAnnouncementAction(
  _previousState: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const actor = await requireRole(["CONTENT_EDITOR"]);

  const parsed = announcementSchema.safeParse(announcementFormDataToRaw(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  if (parsed.data.wingId) {
    const wing = await prisma.wing.findUnique({ where: { id: parsed.data.wingId }, select: { id: true } });
    if (!wing) {
      return { error: "Choose a wing from the list, or leave it as all wings." };
    }
  }

  const item = await prisma.contentItem.create({
    data: {
      type: "ANNOUNCEMENT",
      title: parsed.data.title,
      slug: await uniqueSlug(parsed.data.title),
      body: parsed.data.body,
      tags: [],
      wingId: parsed.data.wingId ?? null,
      publishAt: parsed.data.publishAt ?? null,
      isPublished: parsed.data.isPublished,
      uploadedById: actor.id,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "content.created",
    entity: "ContentItem",
    entityId: item.id,
    before: null,
    after: item,
  });

  revalidatePath("/admin/content/announcements");
  revalidatePath("/account");
  return { success: true };
}

// ContentItem.slug is unique across every content type, so a repeated
// title ("No ta'leem this Saturday" will recur) gets a short suffix.
async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 8)}`;
    const existing = await prisma.contentItem.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `${base}-${Date.now()}`;
}
