import { computeAuditDiff } from "@/lib/audit/diff";
import { getMemberActivity, isHiddenAuditField, staffLabel } from "@/lib/members/member-view";
import { formatLagosDateTime } from "@/lib/timezone";
import { StatusTag } from "@/components/status-tag";
import { TabPager } from "./tab-pager";

const PAGE_SIZE = 25;
const MAX_VALUE_LENGTH = 80;

/** "member.record_section_saved" becomes "Record section saved". */
function actionLabel(action: string): string {
  const words = action.split(".").slice(1).join(" ").replace(/_/g, " ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : action;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}...` : text;
}

// MEMBER-HOME-AND-ADMIN-VIEW.md 2.6. The member's own edits are marked
// as theirs, distinct from anything the office did, by comparing the
// actor to the member's own login.
export async function ActivityTab({
  member,
  page,
}: {
  member: { id: string; userId: string | null };
  page: number;
}) {
  const { entries, total } = await getMemberActivity(member, { page, pageSize: PAGE_SIZE });

  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded for this member.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((entry) => {
            const byMember = member.userId !== null && entry.actorId === member.userId;
            const diff = computeAuditDiff(entry.before, entry.after);
            return (
              <li key={entry.id} className="rounded-md border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {actionLabel(entry.action)}
                    {entry.entity === "User" ? " (login)" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatLagosDateTime(entry.createdAt)}</span>
                </div>
                <div className="mt-1">
                  {byMember ? (
                    <StatusTag tone="neutral">By the member</StatusTag>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {entry.actorId ? `By the office: ${staffLabel(entry.actor)}` : "By the system"}
                    </span>
                  )}
                </div>
                {diff.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {diff.map((row) => (
                      <li key={row.field}>
                        <span className="font-mono">{row.field}</span>
                        {isHiddenAuditField(row.field)
                          ? " changed"
                          : `: ${displayValue(row.before)} to ${displayValue(row.after)}`}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <TabPager
        basePath={`/admin/members/${member.id}`}
        params={{ tab: "activity" }}
        pageParam="page"
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
