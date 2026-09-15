import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewContent } from "@/lib/content/visibility";
import { createSignedFileUrl } from "@/lib/storage";
import { FileButton } from "./file-button";

const TYPE_LABELS: Record<string, string> = {
  SERMON: "Sermon",
  WEEKLY_BOOK: "Weekly book",
  ARTICLE: "Article",
  ANNOUNCEMENT: "Announcement",
};

// Just long enough to render this one page view, not a download: the
// cover is refreshed on every visit, never stored anywhere.
const COVER_URL_EXPIRY_SECONDS = 300;

export default async function ContentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user.memberId) {
    return <p className="text-sm text-muted-foreground">This account is not linked to a member record.</p>;
  }

  const { slug } = await params;

  const [member, item] = await Promise.all([
    prisma.member.findUnique({ where: { id: user.memberId }, select: { wingId: true } }),
    prisma.contentItem.findUnique({ where: { slug } }),
  ]);

  // Re-checked here, not just relied on from the list page: a direct or
  // bookmarked link should not reveal an item that was unpublished,
  // rescheduled, or restricted to a different wing since it was last seen.
  if (!item || !canViewContent(item, member?.wingId ?? null)) {
    notFound();
  }

  const coverUrl = item.coverPath ? await createSignedFileUrl(item.coverPath, COVER_URL_EXPIRY_SECONDS) : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted-foreground">{TYPE_LABELS[item.type] ?? item.type}</p>
        <h1 className="text-lg font-semibold">{item.title}</h1>
        <p className="text-sm text-muted-foreground">
          {item.author ?? "Unknown"}
          {item.deliveredOn ? ` · ${item.deliveredOn.toLocaleDateString("en-NG")}` : ""}
        </p>
      </div>

      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed, short lived URL from private storage, not a static asset next/image can optimise
        <img src={coverUrl} alt="" className="max-h-64 w-auto rounded-md border object-contain" />
      ) : null}

      {item.summary ? <p className="text-sm">{item.summary}</p> : null}
      {item.body ? <p className="whitespace-pre-wrap text-sm">{item.body}</p> : null}

      {item.tags.length > 0 ? <p className="text-xs text-muted-foreground">{item.tags.join(", ")}</p> : null}

      {item.filePath ? <FileButton contentId={item.id} filePath={item.filePath} /> : null}

      {item.externalUrl ? (
        <a href={item.externalUrl} target="_blank" rel="noreferrer" className="self-start text-sm font-medium underline">
          Watch video
        </a>
      ) : null}
    </div>
  );
}
