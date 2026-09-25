import Link from "next/link";
import { Button } from "@/components/ui/button";

// Previous and next links for one paginated list on a member tab. The
// other query parameters (tab, filters, another list's page) are carried
// over, so paging one list never resets the rest of the view.
export function TabPager({
  basePath,
  params,
  pageParam,
  page,
  total,
  pageSize,
}: {
  basePath: string;
  params: Record<string, string>;
  pageParam: string;
  page: number;
  total: number;
  pageSize: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function href(target: number): string {
    const next = new URLSearchParams(params);
    next.set(pageParam, String(target));
    return `${basePath}?${next.toString()}`;
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" disabled={page <= 1} render={<Link href={href(Math.max(1, page - 1))}>Previous</Link>} />
        <Button
          variant="outline"
          disabled={page >= totalPages}
          render={<Link href={href(Math.min(totalPages, page + 1))}>Next</Link>}
        />
      </div>
    </div>
  );
}

export function parsePage(value: string | undefined): number {
  return Math.max(1, Number(value ?? "1") || 1);
}
