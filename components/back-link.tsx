import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// A drill-down page (a detail view, a "new" form) always sits one level
// below a list a link in the sidebar already reaches, so this is about
// making that one step back obvious, not about being the only way there.
export function BackLink({
  href,
  label,
  className = "",
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground ${className}`}
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
