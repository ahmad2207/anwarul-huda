"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { searchMembersForAttendanceReport } from "./actions";
import type { ReportMemberSearchResult } from "./actions";

/**
 * A search box that navigates to this same report with a memberId set,
 * rather than a form field, since the report page is driven entirely by
 * the URL (so from/to and an export link can carry the same filters).
 */
export function MemberPicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReportMemberSearchResult[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const found = await searchMembersForAttendanceReport(value);
      setResults(found);
    }, 250);
  }

  function select(memberId: string) {
    const params = new URLSearchParams();
    params.set("memberId", memberId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/admin/attendance/reports/member?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-1">
      <Input value={query} onChange={(event) => handleQueryChange(event.target.value)} placeholder="Search..." />
      {results.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-1 rounded-md border p-1">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                onClick={() => select(result.id)}
              >
                {result.label} &middot; {result.wingName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
