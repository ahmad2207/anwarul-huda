import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordProgress } from "@/lib/members/record-sections";
import { MemberCard, PageTitle } from "@/components/member/card";
import { primaryButtonClass } from "@/components/member/form";

// MEMBER-INTERFACE.md 3.6: reached exactly once, right after the forced
// password change on a member's very first login (see the redirect in
// app/change-password/actions.ts), never on a voluntary later change.
// Shown inside the normal member shell, bottom nav included.
export default async function AccountWelcomePage() {
  const user = await getCurrentUser();
  const member = user.memberId
    ? await prisma.member.findUnique({ where: { id: user.memberId }, select: { completedSections: true } })
    : null;
  // Get started goes straight to the first section still to do.
  const next = member ? recordProgress(member.completedSections).nextSection : null;
  const startHref = next ? `/account/record/${next.key}` : "/account/record";

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Assalamu alaikum, and welcome</PageTitle>

      <MemberCard className="flex flex-col gap-3 text-base text-ink-2">
        <p>
          This is your own account with the league: your record, your payments, and the sermons and
          books the league shares.
        </p>
        <p>
          Your record needs completing. Only you know how your name should be split, whether your
          contact details are right, and who to list as next of kin, so the next few screens ask you
          for that, one short section at a time. You can stop and come back whenever you like.
        </p>
        <p className="font-medium text-ink">Only the office can see what you enter.</p>
      </MemberCard>

      <Link href={startHref} className={`${primaryButtonClass} self-start`}>
        Get started
        <ArrowRight className="size-5" aria-hidden="true" />
      </Link>
    </div>
  );
}
