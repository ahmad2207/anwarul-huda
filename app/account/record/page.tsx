import Link from "next/link";
import { Check, Pencil } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RECORD_SECTIONS, recordProgress } from "@/lib/members/record-sections";

// The contents view MEMBER-INTERFACE.md 3.4 asks for: every section in
// order, so a member can jump straight to the one they want to correct
// rather than walking through the other eight to get there.
export default async function RecordContentsPage() {
  const user = await getCurrentUser();
  if (!user.memberId) {
    return (
      <p className="text-base text-muted-foreground">
        This account is not linked to a member record. Contact the office.
      </p>
    );
  }

  const member = await prisma.member.findUnique({
    where: { id: user.memberId },
    select: { completedSections: true },
  });
  if (!member) {
    return (
      <p className="text-base text-muted-foreground">
        This account is not linked to a member record. Contact the office.
      </p>
    );
  }

  const progress = recordProgress(member.completedSections);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Your record</h1>
        <p className="text-base text-muted-foreground">
          {progress.completedCount} of {progress.total} sections done
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {RECORD_SECTIONS.map((section) => {
          const isDone = member.completedSections.includes(section.section);
          // MEMBER-INTERFACE.md 3.5: once the whole record is complete,
          // this view is no longer a fill-in checklist, it is a list of
          // things a member can go back and correct, so a done row reads
          // as "Edit" rather than a bare checkmark.
          const indicator = isDone ? (
            progress.isComplete ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </span>
            ) : (
              <Check className="size-5 shrink-0 text-amber-800" aria-label="Done" />
            )
          ) : (
            <span className="text-sm text-muted-foreground">Not started</span>
          );

          return (
            <li key={section.key}>
              <Link
                href={`/account/record/${section.key}`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-[4px] border border-border p-3 hover:bg-muted/30"
              >
                <span className="flex items-center gap-3 text-base">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                    {section.order}
                  </span>
                  {section.label}
                </span>
                {indicator}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
