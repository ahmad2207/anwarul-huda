import Link from "next/link";
import type { RecordSection } from "@prisma/client";
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
import { Button } from "@/components/ui/button";
import { AttentionBlock } from "./attention-block";

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
    return <IncompleteHome greeting={greeting} completedSections={member.completedSections} />;
  }

  return <CompleteHome greeting={greeting} member={member} />;
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-navy-900">{greeting}</h1>

      <div className="flex flex-col gap-2">
        <p className="text-base font-medium">
          Your record is {progress.completedCount} of {progress.total} done
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="presentation">
          <div className="h-full rounded-full bg-amber-800" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {progress.nextSection ? (
          <p className="text-base text-muted-foreground">Next: {progress.nextSection.label.toLowerCase()}</p>
        ) : null}
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">{greeting}</h1>
        <p className="font-mono text-sm text-muted-foreground">{member.memberNumber ?? "Not yet issued"}</p>
      </div>

      <AttentionBlock items={attention} />

      {upcoming.length > 0 ? (
        <HomeSection title="What is next">
          {upcoming.map((gathering) => (
            <div key={gathering.id} className="rounded-[4px] border border-border bg-card p-3">
              <p className="text-base font-medium">{gathering.title}</p>
              <p className="text-sm text-muted-foreground">
                {formatGatheringWhen(gathering.startsAt)}
                {gathering.branchName ? `, ${gathering.branchName}` : ""}
              </p>
            </div>
          ))}
        </HomeSection>
      ) : null}

      {/* A count and a date, never a percentage, a streak or a badge
          (MEMBER-HOME-AND-ADMIN-VIEW.md 1.3). Shown even at 0 of 0, since
          "when did I last attend" is still worth answering. */}
      <HomeSection title="Your attendance">
        <Link
          href="/account/attendance"
          className="flex min-h-11 flex-col justify-center rounded-[4px] border border-border bg-card p-3 hover:bg-muted/30"
        >
          <span className="text-base">
            {attendance.attendedThisMonth} of {attendance.heldThisMonth} gatherings this month
          </span>
          <span className="text-sm text-muted-foreground">
            {attendance.lastAttendedAt
              ? `Last attended ${formatDayMonth(attendance.lastAttendedAt)}`
              : "No attendance recorded yet"}
          </span>
        </Link>
      </HomeSection>

      {serviceAreas.length > 0 ? (
        <HomeSection title="Your service">
          <p className="text-base">{serviceAreas.join(", ")}</p>
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
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-medium">{title}</h2>
      {children}
    </section>
  );
}

function ContentLink({ slug, title, detail }: { slug: string; title: string; detail: string }) {
  return (
    <Link
      href={`/library/${slug}`}
      className="flex min-h-11 flex-col justify-center rounded-[4px] border border-border p-3 text-base hover:bg-muted/30"
    >
      <span className="font-medium">{title}</span>
      <span className="line-clamp-2 text-sm text-muted-foreground">{detail}</span>
    </Link>
  );
}
