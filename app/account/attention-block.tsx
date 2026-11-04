import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatMonthYear, hasAttentionItems, type AttentionItems } from "@/lib/members/member-home";
import { BalanceCard } from "@/components/member/balance-card";
import { SectionHeading, memberLinkCardClass } from "@/components/member/card";
import { StatusTag } from "@/components/status-tag";

// Rendered first on the complete home so a member never scrolls past a
// sermon to learn they are in arrears (MEMBER-HOME-AND-ADMIN-VIEW.md
// 1.1). Returns null when nothing is outstanding: no empty state.
export function AttentionBlock({ items }: { items: AttentionItems }) {
  if (!hasAttentionItems(items)) {
    return null;
  }

  return (
    <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
      <SectionHeading id="attention-heading">Needs your attention</SectionHeading>

      {items.balance ? (
        <BalanceCard
          amountKobo={items.balance.totalKobo}
          label="Your outstanding dues"
          detail={`For ${items.balance.planNames.join(", ")}, since ${formatMonthYear(items.balance.since)}`}
          action={
            <Link
              href="/account/payments"
              className="inline-flex h-12 items-center gap-2 rounded-[14px] border border-white/35 bg-white/10 px-5 text-base font-semibold text-white hover:bg-white/20"
            >
              View payments
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          }
        />
      ) : null}

      {items.nextRecordSection ? (
        <Link href={`/account/record/${items.nextRecordSection.key}`} className={memberLinkCardClass}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-semibold text-ink">Your record is not finished</span>
            <StatusTag tone="attention">To do</StatusTag>
          </span>
          <span className="text-base text-ink-2">Next: {items.nextRecordSection.label.toLowerCase()}</span>
        </Link>
      ) : null}
    </section>
  );
}
