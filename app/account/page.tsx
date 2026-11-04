import Link from "next/link";
import type { RecordSection } from "@prisma/client";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Wallet,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { firstNameForGreeting } from "@/lib/members/display-name";
import { RECORD_SECTIONS, recordProgress } from "@/lib/members/record-sections";
import {
  formatDayMonth,
  formatGatheringWhen,
  getAttendanceSummary,
  getAttentionItems,
  getLatestContent,
  getServiceAreaNames,
  getUpcomingGatherings,
} from "@/lib/members/member-home";
import { MemberCard, SectionHeading, memberCardClass, memberLinkCardClass } from "@/components/member/card";
import { primaryButtonClass } from "@/components/member/form";
import { AttentionBlock } from "./attention-block";

export default async function AccountHomePage() {
  const user = await getCurrentUser();

  if (!user.memberId) {
    return <NotLinked />;
  }

  const member = await prisma.member.findUnique({ where: { id: user.memberId } });
  if (!member) {
    return <NotLinked />;
  }

  // The member's own title from their record, such as Alhaji, Mallam or
  // Dr, goes before their first name: "Alhaji Ewumi".
  const firstName = firstNameForGreeting(member) ?? "";
  const title = member.title?.trim() ?? "";
  const name = firstName && title ? `${title} ${firstName}` : firstName;

  if (member.isRecordIncomplete) {
    return <IncompleteHome name={name} completedSections={member.completedSections} />;
  }

  return <CompleteHome name={name} member={member} />;
}

function NotLinked() {
  return <p className="text-ink-2">This account is not linked to a member record. Contact the office.</p>;
}

// The one welcome on Home: the greeting, in the light-in-the-dark style
// of the header above it, with the member number in mono.
function GreetingCard({ name, memberNumber, subtitle }: { name: string; memberNumber?: string; subtitle?: string }) {
  return (
    <div className="on-navy relative overflow-hidden rounded-[14px] bg-gradient-to-br from-navy-900 to-navy-950 px-5 py-5 text-white shadow-warm">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-10 size-44 rounded-full bg-amber-500/25 blur-3xl"
      />
      <p className="relative text-sm text-white/70">Assalamu alaikum{name ? "," : ""}</p>
      {name ? (
        <h1 className="relative font-heading text-2xl leading-tight font-semibold">{name}</h1>
      ) : (
        <h1 className="sr-only">Home</h1>
      )}
      {memberNumber ? (
        <p className="relative mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 font-mono text-xs tracking-wide text-amber-300">
          {memberNumber}
        </p>
      ) : null}
      {subtitle ? <p className="relative mt-2 text-sm text-white/75">{subtitle}</p> : null}
    </div>
  );
}

function IncompleteHome({ name, completedSections }: { name: string; completedSections: RecordSection[] }) {
  const progress = recordProgress(completedSections);
  const progressPercent = Math.round((progress.completedCount / progress.total) * 100);
  // MEMBER-INTERFACE.md 3.6: Continue goes straight to the next section
  // still to do, not to the contents list.
  const continueHref = progress.nextSection ? `/account/record/${progress.nextSection.key}` : "/account/record";

  // MEMBER-INTERFACE.md 3.2: while the record is incomplete, finishing it
  // is the whole page. Nothing else competes with it.
  return (
    <div className="flex flex-col gap-5">
      <GreetingCard name={name} subtitle="Let us finish your membership record together." />

      <MemberCard className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <p id="progress-label" className="font-heading text-base font-semibold text-navy-900">
            Your record
          </p>
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-navy-900">{progress.completedCount}</span> of {progress.total} done
          </p>
        </div>

        <div
          className="flex gap-1"
          role="progressbar"
          aria-labelledby="progress-label"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.completedCount}
          aria-valuetext={`${progressPercent} percent`}
        >
          {RECORD_SECTIONS.map((section) => (
            <span
              key={section.key}
              className={`h-1.5 flex-1 rounded-full ${completedSections.includes(section.section) ? "bg-sabon" : "bg-paper-dim"}`}
            />
          ))}
        </div>

        <ol className="flex flex-col gap-2">
          {RECORD_SECTIONS.map((section) => {
            const done = completedSections.includes(section.section);
            const isNext = progress.nextSection?.key === section.key;
            return (
              <li key={section.key} className="flex items-center gap-2.5 text-sm">
                <span
                  aria-hidden="true"
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    done ? "bg-sabon text-white" : isNext ? "bg-navy-900 text-white" : "bg-paper-dim text-ink-2"
                  }`}
                >
                  {done ? <Check className="size-3" strokeWidth={3} /> : section.order}
                </span>
                <span className={isNext ? "font-semibold text-ink" : "text-ink-2"}>{section.label}</span>
                {done ? <span className="sr-only">, done</span> : null}
                {isNext ? <span className="sr-only">, next</span> : null}
              </li>
            );
          })}
        </ol>

        <Link href={continueHref} className={`${primaryButtonClass} w-full sm:w-auto sm:self-start`}>
          {progress.completedCount === 0 ? "Start" : "Continue"}
          {progress.nextSection ? ` with ${progress.nextSection.label.toLowerCase()}` : ""}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </MemberCard>

      {/* The explanation stays visible the whole time a record is
          incomplete (MEMBER-INTERFACE.md 3.2), not just on first visit:
          a member who does not understand why is a member who will not
          finish. */}
      <div className="rounded-[14px] bg-paper-dim/70 p-4">
        <p className="font-heading text-sm font-semibold text-navy-900">Why we are asking</p>
        <p className="mt-1 text-sm text-ink-2">
          The league is building a complete record of every member. Only the office can see what you enter.
        </p>
      </div>
    </div>
  );
}

const QUICK_LINKS = [
  { href: "/account/record", label: "Record", icon: ClipboardList },
  { href: "/account/payments", label: "Payments", icon: Wallet },
  { href: "/library", label: "Books", icon: BookOpen },
  { href: "/account/attendance", label: "Attendance", icon: CalendarCheck },
] as const;

// The complete home (MEMBER-HOME-AND-ADMIN-VIEW.md 1). Order is
// deliberate: attention, next, attendance, service, latest, so a member
// never scrolls past a sermon to learn they are in arrears. Every block
// is a small server-rendered summary with a route onward; any block
// with nothing to say renders nothing.
async function CompleteHome({
  name,
  member,
}: {
  name: string;
  member: {
    id: string;
    memberNumber: string | null;
    wingId: string;
    completedSections: RecordSection[];
  };
}) {
  const [attention, upcoming, attendance, serviceAreas, announcement, sermon, book] = await Promise.all([
    getAttentionItems(member),
    getUpcomingGatherings(member),
    getAttendanceSummary(member),
    getServiceAreaNames(member.id),
    getLatestContent("ANNOUNCEMENT", member.wingId),
    getLatestContent("SERMON", member.wingId),
    getLatestContent("WEEKLY_BOOK", member.wingId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <GreetingCard name={name} memberNumber={member.memberNumber ?? "Member number not yet issued"} />

      <AttentionBlock items={attention} />

      <nav aria-label="Quick links" className="grid grid-cols-4 gap-2">
        {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${memberCardClass} flex min-h-[76px] flex-col items-center justify-center gap-1.5 px-1 py-3 text-center text-xs font-semibold text-navy-900 transition-colors hover:bg-paper-dim/50`}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-navy-900/[0.06] text-navy-800">
              <Icon className="size-[18px]" aria-hidden="true" />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      {upcoming.length > 0 ? (
        <HomeSection title="What is next">
          {upcoming.map((gathering) => (
            <MemberCard key={gathering.id} className="flex items-start gap-3 px-4 py-3">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-navy-700" aria-hidden="true" />
              <div>
                <p className="font-semibold">{gathering.title}</p>
                <p className="text-sm text-ink-2">
                  {formatGatheringWhen(gathering.startsAt)}
                  {gathering.branchName ? `, ${gathering.branchName}` : ""}
                </p>
              </div>
            </MemberCard>
          ))}
        </HomeSection>
      ) : null}

      {/* A count and a date, never a percentage, a streak or a badge
          (MEMBER-HOME-AND-ADMIN-VIEW.md 1.3). Shown even at 0 of 0, since
          "when did I last attend" is still worth answering. */}
      <HomeSection title="Your attendance">
        <Link href="/account/attendance" className={memberLinkCardClass}>
          <span className="flex items-center justify-between gap-2">
            <span className="font-semibold">
              {attendance.attendedThisMonth} of {attendance.heldThisMonth} gatherings this month
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-2" aria-hidden="true" />
          </span>
          <span className="text-sm text-ink-2">
            {attendance.lastAttendedAt
              ? `Last attended ${formatDayMonth(attendance.lastAttendedAt)}`
              : "No attendance recorded yet"}
          </span>
        </Link>
      </HomeSection>

      {serviceAreas.length > 0 ? (
        <HomeSection title="Your service">
          <MemberCard className="px-4 py-3">
            <p className="text-sm">{serviceAreas.join(", ")}</p>
          </MemberCard>
        </HomeSection>
      ) : null}

      {announcement || sermon || book ? (
        <HomeSection title="Latest">
          {announcement ? (
            <ContentLink
              slug={announcement.slug}
              title={announcement.title}
              // An announcement from the announcements page has no summary; its message is the detail.
              detail={(announcement.summary ?? announcement.body ?? "Announcement").slice(0, 200)}
            />
          ) : null}
          {sermon ? (
            <ContentLink
              slug={sermon.slug}
              title={sermon.title}
              detail={sermon.deliveredOn ? formatDayMonth(sermon.deliveredOn) : "Sermon"}
            />
          ) : null}
          {book ? <ContentLink slug={book.slug} title={book.title} detail="This week's book" /> : null}
        </HomeSection>
      ) : null}
    </div>
  );
}

function HomeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}

function ContentLink({ slug, title, detail }: { slug: string; title: string; detail: string }) {
  return (
    <Link href={`/library/${slug}`} className={memberLinkCardClass}>
      <span className="font-semibold">{title}</span>
      <span className="line-clamp-2 text-sm text-ink-2">{detail}</span>
    </Link>
  );
}
