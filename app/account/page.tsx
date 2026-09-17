import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { firstNameForGreeting } from "@/lib/members/display-name";
import { Button } from "@/components/ui/button";

// The nine sections MEMBER-INTERFACE.md 3.4 lists, in order. Section
// completion is not tracked yet: that lands with the record itself
// (M3), which is explicitly not part of this build ("no record sections
// yet"). Until then, every incomplete record is honestly at 0 of 9,
// because nobody has been able to complete a single section, since
// there is nowhere yet to do that. This is not a placeholder standing
// in for a real number: it is the true count today. M3 replaces
// `completedCount` below with a real one once sections exist to finish.
const RECORD_SECTIONS = [
  "Your name",
  "About you",
  "Contact details",
  "Household",
  "Your membership",
  "Service and skills",
  "Next of kin",
  "Consent",
  "Face check-in",
];

export default async function AccountHomePage() {
  const user = await getCurrentUser();

  if (!user.memberId) {
    return (
      <p className="text-base text-muted-foreground">
        This account is not linked to a member record. Contact the office.
      </p>
    );
  }

  const member = await prisma.member.findUnique({ where: { id: user.memberId } });
  if (!member) {
    return (
      <p className="text-base text-muted-foreground">
        This account is not linked to a member record. Contact the office.
      </p>
    );
  }

  const greetingName = firstNameForGreeting(member);
  const greeting = greetingName ? `Assalamu alaikum, ${greetingName}` : "Assalamu alaikum";

  if (member.isRecordIncomplete) {
    return <IncompleteHome greeting={greeting} />;
  }

  return <CompleteHome greeting={greeting} member={member} />;
}

function IncompleteHome({ greeting }: { greeting: string }) {
  const completedCount = 0; // see the comment on RECORD_SECTIONS above
  const nextSection = RECORD_SECTIONS[completedCount];
  const progressPercent = Math.round((completedCount / RECORD_SECTIONS.length) * 100);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-navy-900">{greeting}</h1>

      <div className="flex flex-col gap-2">
        <p className="text-base font-medium">
          Your record is {completedCount} of {RECORD_SECTIONS.length} done
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="presentation">
          <div className="h-full rounded-full bg-amber-800" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-base text-muted-foreground">Next: {nextSection.toLowerCase()}</p>
        <Button
          render={<Link href="/account/record">Continue</Link>}
          className="h-11 self-start rounded-[4px] px-6 text-base"
        />
      </div>

      {/* The explanation stays visible the whole time a record is
          incomplete (MEMBER-INTERFACE.md 3.2), not just on first visit:
          a member who does not understand why is a member who will not
          finish. */}
      <div className="rounded-[4px] border border-border bg-card p-4">
        <p className="text-base font-medium">Why we are asking</p>
        <p className="mt-1 text-base text-muted-foreground">
          The league is building a complete record of every member. Only the office can see what you
          enter.
        </p>
      </div>
    </div>
  );
}

async function CompleteHome({
  greeting,
  member,
}: {
  greeting: string;
  member: { id: string; memberNumber: string | null; wingId: string };
}) {
  // amountPaidKobo < amountDueKobo is a column-to-column comparison,
  // which Prisma's query builder cannot express in a where clause (see
  // lib/reports/arrears.ts, which resorts to raw SQL for the same
  // reason, across every member at once). A single member's own records
  // are few enough that fetching them all and filtering in JS is the
  // simpler, still correct choice here, rather than reaching for raw
  // SQL for one row.
  const [records, latestSermon, latestBook] = await Promise.all([
    prisma.contributionRecord.findMany({
      where: { memberId: member.id },
      include: { plan: true },
      orderBy: { periodStart: "desc" },
    }),
    latestPublishedContent("SERMON", member.wingId),
    latestPublishedContent("WEEKLY_BOOK", member.wingId),
  ]);

  const outstandingRecords = records.filter((record) => record.amountPaidKobo < record.amountDueKobo);
  const outstandingKobo = outstandingRecords.reduce(
    (sum, record) => sum + (record.amountDueKobo - record.amountPaidKobo),
    0,
  );
  // Records are already ordered by periodStart descending, so the first
  // outstanding one found is the most recently due, the one worth
  // naming in the "what it is for" line (MEMBER-INTERFACE.md 3.3): a
  // running total with nothing to point at reads as an accusation, not
  // information.
  const outstandingRecord = outstandingRecords[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">{greeting}</h1>
        <p className="font-mono text-sm text-muted-foreground">{member.memberNumber ?? "Not yet issued"}</p>
      </div>

      {/* The one warm card (DESIGN.md 4.2): amber only appears here,
          against navy, because this is the number that matters most.
          Everything else on the page stays plain and readable. */}
      <div className="relative overflow-hidden rounded-[4px] bg-navy-900 p-5 text-white">
        <p className="text-sm uppercase tracking-wide text-white/60">Outstanding</p>
        <p className={`mt-1 font-mono text-3xl font-semibold ${outstandingKobo > 0 ? "text-amber-500" : "text-white"}`}>
          {formatNaira(outstandingKobo, { symbol: "unicode" })}
        </p>
        <p className="mt-1 text-base text-white/70">
          {outstandingRecord
            ? `${outstandingRecord.plan.name}, ${outstandingRecord.periodStart.toLocaleDateString("en-NG", { month: "long" })}`
            : outstandingKobo > 0
              ? "Catch up whenever you can."
              : "You're paid up. Jazakumullahu khairan."}
        </p>
        <Button
          render={<Link href="/account/payments">View payments</Link>}
          variant="outline"
          className="mt-3 h-11 rounded-[4px] border-white/30 bg-transparent px-5 text-base text-white hover:bg-white/10 hover:text-white"
        />
      </div>

      {/* Face check-in is not built yet (a later, separate prompt): every
          member is honestly "awaiting setup" today, since there is
          nowhere yet to set it up. Not a placeholder invented for this
          screen, the true state of a feature that does not exist yet. */}
      <div className="flex items-center justify-between rounded-[4px] border border-border bg-card p-4">
        <div>
          <p className="text-base font-medium">Face check-in</p>
          <p className="text-sm text-muted-foreground">Set up at the mosque, when it&apos;s ready</p>
        </div>
        <span className="rounded-full bg-amber-soft px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          Awaiting setup
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-base font-medium">Latest</p>
        {latestSermon ? (
          <Link
            href={`/library/${latestSermon.slug}`}
            className="flex min-h-11 flex-col justify-center rounded-[4px] border border-border p-3 text-base hover:bg-muted/30"
          >
            <span className="font-medium">{latestSermon.title}</span>
            <span className="text-sm text-muted-foreground">
              {latestSermon.deliveredOn?.toLocaleDateString("en-NG", { day: "numeric", month: "long" }) ??
                "Friday khutbah"}
            </span>
          </Link>
        ) : null}
        {latestBook ? (
          <Link
            href={`/library/${latestBook.slug}`}
            className="flex min-h-11 flex-col justify-center rounded-[4px] border border-border p-3 text-base hover:bg-muted/30"
          >
            <span className="font-medium">{latestBook.title}</span>
            <span className="text-sm text-muted-foreground">This week&apos;s book</span>
          </Link>
        ) : null}
        {!latestSermon && !latestBook ? (
          <p className="text-base text-muted-foreground">Nothing published yet.</p>
        ) : null}
      </div>
    </div>
  );
}

// Same visibility rule as app/library/page.tsx: published, past its
// publish time if it has one, and either open to every wing or matching
// this member's own. Kept as its own small query rather than importing
// the library page's own logic, since that file also carries its
// search/filter form, which nothing here needs.
function latestPublishedContent(type: "SERMON" | "WEEKLY_BOOK", wingId: string) {
  return prisma.contentItem.findFirst({
    where: {
      type,
      isPublished: true,
      AND: [
        { OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
        { OR: [{ wingId: null }, { wingId }] },
      ],
    },
    select: { slug: true, title: true, deliveredOn: true },
    orderBy: { createdAt: "desc" },
  });
}
