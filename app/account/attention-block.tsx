import Link from "next/link";
import { formatNaira } from "@/lib/money";
import { formatMonthYear, hasAttentionItems, type AttentionItems } from "@/lib/members/member-home";
import { Button } from "@/components/ui/button";

// Rendered first on the complete home so a member never scrolls past a
// sermon to learn they are in arrears (MEMBER-HOME-AND-ADMIN-VIEW.md
// 1.1). Returns null when nothing is outstanding: no empty state.
export function AttentionBlock({ items }: { items: AttentionItems }) {
  if (!hasAttentionItems(items)) {
    return null;
  }

  return (
    <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
      <h2 id="attention-heading" className="text-base font-medium">
        Needs your attention
      </h2>

      {/* The one warm card (DESIGN.md 4.2), now shown only when there is
          a balance to carry. */}
      {items.balance ? (
        <div className="rounded-[4px] bg-navy-900 p-5 text-white">
          <p className="text-sm uppercase tracking-wide text-white/60">Outstanding</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-amber-500">
            {formatNaira(items.balance.totalKobo)}
          </p>
          <p className="mt-1 text-base text-white/70">
            {items.balance.planNames.join(", ")}, since {formatMonthYear(items.balance.since)}
          </p>
          <Button
            render={<Link href="/account/payments">View payments</Link>}
            variant="outline"
            className="mt-3 h-11 rounded-[4px] border-white/30 bg-transparent px-5 text-base text-white hover:bg-white/10 hover:text-white"
          />
        </div>
      ) : null}

      {items.nextRecordSection ? (
        <Link
          href={`/account/record/${items.nextRecordSection.key}`}
          className="flex min-h-11 flex-col justify-center rounded-[4px] border border-border bg-card p-4 hover:bg-muted/30"
        >
          <span className="text-base font-medium">Your record is not finished</span>
          <span className="text-sm text-muted-foreground">
            Next: {items.nextRecordSection.label.toLowerCase()}
          </span>
        </Link>
      ) : null}

      {items.faceAwaitingSetup ? (
        <div className="rounded-[4px] border border-border bg-card p-4">
          <p className="text-base font-medium">Face check-in</p>
          <p className="text-sm text-muted-foreground">
            The office will help you set this up at the mosque. Until then you are checked in by name.
          </p>
        </div>
      ) : null}
    </section>
  );
}
