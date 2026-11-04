import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { memberCardClass } from "@/components/member/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewContent } from "@/lib/content/visibility";
import { createSignedFileUrl } from "@/lib/storage";
import { FileButton } from "./file-button";
import { formatLagosDate } from "@/lib/timezone";

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
    return <p className="text-base text-ink-2">This account is not linked to a member record.</p>;
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
    <article className="flex flex-col gap-5">
      <Link href="/library" className="inline-flex min-h-11 items-center gap-1 self-start text-base font-medium text-navy-700 underline-offset-4 hover:underline">
        <ChevronLeft className="size-5" aria-hidden="true" />
        All books
      </Link>

      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-navy-700">{TYPE_LABELS[item.type] ?? item.type}</p>
        <h1 className="font-heading text-2xl font-semibold leading-tight text-navy-900">{item.title}</h1>
        <p className="text-base text-ink-2">
          {item.author ?? "Unknown"}
          {item.deliveredOn ? `, ${formatLagosDate(item.deliveredOn)}` : ""}
        </p>
      </div>

      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed, short lived URL from private storage, not a static asset next/image can optimise
        <img src={coverUrl} alt="" className="max-h-72 w-auto self-start rounded-[14px] object-contain shadow-warm" />
      ) : null}

      {item.filePath ? <FileButton contentId={item.id} filePath={item.filePath} /> : null}

      {item.externalUrl ? (
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start text-base font-semibold text-navy-700 underline underline-offset-4"
        >
          <ExternalLink className="size-5" aria-hidden="true" />
          Watch video
        </a>
      ) : null}

      {item.summary || item.body ? (
        <div className={`${memberCardClass} flex max-w-[70ch] flex-col gap-3 p-5`}>
          {item.summary ? <p className="text-base font-medium">{item.summary}</p> : null}
          {item.body ? <p className="whitespace-pre-wrap text-base">{item.body}</p> : null}
        </div>
      ) : null}

      {item.tags.length > 0 ? <p className="text-sm text-ink-2">{item.tags.join(", ")}</p> : null}
    </article>
  );
}
