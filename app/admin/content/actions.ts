"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { uploadFile } from "@/lib/storage";
import { slugify } from "@/lib/content/slug";
import { contentFormDataToRaw, contentSchema } from "./schema";

export interface ContentActionState {
  error?: string;
  success?: boolean;
}

export async function createContentAction(
  _previousState: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const actor = await requireRole(["CONTENT_EDITOR"]);

  const parsed = contentSchema.safeParse(contentFormDataToRaw(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const rawFile = formData.get("file");
  const rawCover = formData.get("coverImage");
  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
  const cover = rawCover instanceof File && rawCover.size > 0 ? rawCover : null;

  if (!file && !parsed.data.externalUrl && !parsed.data.body) {
    return { error: "Provide a file, a link, or written notes: an item needs at least one." };
  }

  const filePath = file ? await uploadFile(file, `content/${parsed.data.type.toLowerCase()}`) : null;
  const coverPath = cover ? await uploadFile(cover, "content/covers") : null;

  const slug = await generateUniqueSlug(parsed.data.title);

  const item = await prisma.contentItem.create({
    data: {
      type: parsed.data.type,
      title: parsed.data.title,
      slug,
      author: parsed.data.author ?? null,
      summary: parsed.data.summary ?? null,
      body: parsed.data.body ?? null,
      filePath,
      coverPath,
      externalUrl: parsed.data.externalUrl ?? null,
      tags: parsed.data.tags,
      wingId: parsed.data.wingId || null,
      deliveredOn: parsed.data.deliveredOn ?? null,
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

  revalidatePath("/admin/content");
  return { success: true };
}

/**
 * Tries the plain slug first, then a handful of suffixed variants if
 * another item already has that title's slug, since ContentItem.slug is
 * unique. Falls back to a timestamp suffix if every short attempt
 * collides, which in practice would mean the same title was uploaded
 * many times in the same second.
 */
async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const existing = await prisma.contentItem.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
