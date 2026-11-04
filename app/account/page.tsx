import Link from "next/link";
import type { RecordSection } from "@prisma/client";
import { ArrowRight, CalendarDays, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { firstNameForGreeting } from "@/lib/members/display-name";
import { recordProgress } from "@/lib/members/record-sections";
import {
  formatDayMonth,
  formatGatheringWhen,
  getAttendanceSummary,
  getAttentionItems,
  getLatestContent,
  getServiceAreaNames,
  getUpcomingGatherings,
} from "@/lib/members/member-home";
import { MemberCard, PageTitle, SectionHeading, memberLinkCardClass } from "@/components/member/card";
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

  const greetingName = firstNameForGreeting(member);
  const greeting = greetingName ? `Assalamu alaikum, ${greetingName}` : "Assalamu alaikum";

  if (member.isRecordIncomplete) {
    return <IncompleteHome greeting={greeting} completedSections={member.completedSections} />;
  }

  return <CompleteHome greeting={greeting} member={member} />;
}

function NotLinked() {
  return (
    <p className="text-base text-ink-2">This account is not linked to a member record. Contact the office.</p>
  );
}

function IncompleteHome({
  greeting,
  completedSections,
}: {
  greeting: string;
  completedSections: Parameters<typeof recordProgress>[0];
}) {
  const progress = recordProgress(completedSections);
  const progressPercent = Math.round((progress.completedCount / progress.total) * 100);
  // MEMBER-INTERFACE.md 3.6: Continue goes straight to the next section
  // still to do, not to the contents list.
  const continueHref = progress.nextSection ? `/account/record/${progress.nextSection.key}` : "/account/record";

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{greeting}</PageTitle>

      <MemberCard className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p id="progress-label" className="font-heading text-lg font-semibold text-navy-900">
            Your record is {progress.completedCount} of {progress.total} done
          </p>
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-paper-dim"
            role="progressbar"
            aria-labelledby="progress-label"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.completedCount}
          >
            <div className="h-full rounded-full bg-navy-900" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {progress.nextSection ? (
          <p className="text-base text-ink-2">Next: {progress.nextSection.label.toLowerCase()}</p>
        ) : null}
        <Link href={continueHref} className={`${primaryButtonClass} self-start`}>
          Continue
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
      </MemberCard>

      {/* The explanation stays visible the whole time a record is
          incomplete (MEMBER-INTERFACE.md 3.2), not just on first visit:
          a member who does not understand why is a member who will not
          finish. */}
      <div className="rounded-[14px] bg-paper-dim/70 p-5">
        <p className="font-heading text-lg font-semibold text-navy-900">Why we are asking</p>
        <p className="mt-1 text-base text-ink-2">
          The league is building a complete record of every member. Only the office can see what you
          enter.
        </p>
      </div>
    </div>
  );
}

// The complete home (MEMBER-HOME-AND-ADMIN-VIEW.md 1). Order is
// deliberate: attention, next, attendance, service, latest, so a member
// never scrolls past a sermon to learn they are in arrears. Every block
// is a small server-rendered summary with a route onward; any block
// with nothing to say renders nothing.
async function CompleteHome({
  greeting,
  member,
}: {
  greeting: string;
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
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1">
        <PageTitle>{greeting}</PageTitle>
        <p className="font-mono text-base text-ink-2">{member.memberNumber ?? "Member number not yet issued"}</p>
      </div>

      <AttentionBlock items={attention} />

      {upcoming.length > 0 ? (
        <HomeSection title="What is next">
          {upcoming.map((gathering) => (
            <MemberCard key={gathering.id} className="flex items-start gap-3 p-4">
              <CalendarDays className="mt-0.5 size-5 shrink-0 text-navy-700" aria-hidden="true" />
              <div>
                <p className="text-base font-semibold">{gathering.title}</p>
                <p className="text-base text-ink-2">
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
            <span className="text-base font-semibold">
              {attendance.attendedThisMonth} of {attendance.heldThisMonth} gatherings this month
            </span>
            <ChevronRight className="size-5 shrink-0 text-ink-2" aria-hidden="true" />
          </span>
          <span className="text-base text-ink-2">
            {attendance.lastAttendedAt
              ? `Last attended ${formatDayMonth(attendance.lastAttendedAt)}`
              : "No attendance recorded yet"}
          </span>
        </Link>
      </HomeSection>

      {serviceAreas.length > 0 ? (
        <HomeSection title="Your service">
          <MemberCard className="p-4">
            <p className="text-base">{serviceAreas.join(", ")}</p>
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
    <section className="flex flex-col gap-3">
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}

function ContentLink({ slug, title, detail }: { slug: string; title: string; detail: string }) {
  return (
    <Link href={`/library/${slug}`} className={memberLinkCardClass}>
      <span className="text-base font-semibold">{title}</span>
      <span className="line-clamp-2 text-base text-ink-2">{detail}</span>
    </Link>
  );
}
