import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RECORD_SECTIONS, recordProgress } from "@/lib/members/record-sections";
import { StatusTag } from "@/components/status-tag";
import { PageTitle, memberCardClass } from "@/components/member/card";

// The contents view MEMBER-INTERFACE.md 3.4 asks for: every section in
// order, so a member can jump straight to the one they want to correct
// rather than walking through the other eight to get there.
export default async function RecordContentsPage() {
  const user = await getCurrentUser();
  const member = user.memberId
    ? await prisma.member.findUnique({ where: { id: user.memberId }, select: { completedSections: true } })
    : null;
  if (!member) {
    return (
      <p className="text-base text-ink-2">This account is not linked to a member record. Contact the office.</p>
    );
  }

  const progress = recordProgress(member.completedSections);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        lead={
          progress.isComplete
            ? "Every section is done. Open any of them to correct something."
            : `${progress.completedCount} of ${progress.total} sections done`
        }
      >
        Your record
      </PageTitle>

      <ul className={`${memberCardClass} divide-y divide-border overflow-hidden`}>
        {RECORD_SECTIONS.map((section) => {
          const isDone = member.completedSections.includes(section.section);
          const isNext = progress.nextSection?.key === section.key;

          return (
            <li key={section.key}>
              <Link
                href={`/account/record/${section.key}`}
                className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 hover:bg-paper-dim/50"
              >
                <span className="flex min-w-0 items-center gap-3 text-base">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold ${
                      isDone ? "bg-sabon-soft text-sabon" : "bg-paper-dim text-ink-2"
                    }`}
                  >
                    {section.order}
                  </span>
                  <span className={isNext ? "font-semibold" : "font-medium"}>{section.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {/* Word and icon together, never colour alone (DESIGN.md 2). */}
                  {isDone ? (
                    <StatusTag tone="confirmed">Done</StatusTag>
                  ) : isNext ? (
                    <StatusTag tone="attention">Next</StatusTag>
                  ) : (
                    <span className="text-sm text-ink-2">Not started</span>
                  )}
                  <ChevronRight className="size-5 text-ink-2" aria-hidden="true" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
