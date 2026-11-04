import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const baseClass =
  "inline-flex h-11 items-center gap-1 rounded-[14px] border px-4 text-base font-medium";

// Previous and Next for every member list. A page that does not exist is
// not a link at all: it is muted text marked aria-disabled, so it can
// neither be followed nor mistaken for something that works.
export function Pager({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-base">
      <span className="text-ink-2">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <PagerLink enabled={page > 1} href={hrefFor(page - 1)} rel="prev">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </PagerLink>
        <PagerLink enabled={page < totalPages} href={hrefFor(page + 1)} rel="next">
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </PagerLink>
      </div>
    </nav>
  );
}

function PagerLink({
  enabled,
  href,
  rel,
  children,
}: {
  enabled: boolean;
  href: string;
  rel: string;
  children: React.ReactNode;
}) {
  if (!enabled) {
    return (
      <span aria-disabled="true" className={`${baseClass} cursor-not-allowed border-border bg-paper-dim/60 text-ink-2/70`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={`${baseClass} border-border bg-card text-navy-900 shadow-warm hover:bg-paper-dim/50`}>
      {children}
    </Link>
  );
}
