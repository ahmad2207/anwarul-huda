import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ageInYears } from "@/lib/members/age";
import { Button } from "@/components/ui/button";
import { FaceCapture } from "./face-capture";
import { WithdrawFaceEnrolmentButton } from "./withdraw-button";

const MINIMUM_ENROLMENT_AGE = 18;

// The integration point M3 left for this prompt (MEMBER-INTERFACE.md
// 3.4: "leave a clear integration point rather than stubbing a fake
// camera"). Consent already happened on section 9's own screen
// (consentBiometric): this route never asks again, and never shows
// capture to a member who has not agreed to it.
export default async function AccountFacePage() {
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
    select: { dateOfBirth: true, consentBiometric: true, faceEnrolmentDeferred: true, faceCheckInExcluded: true },
  });
  if (!member) {
    return (
      <p className="text-base text-muted-foreground">
        This account is not linked to a member record. Contact the office.
      </p>
    );
  }

  // Excluded after a face match review: nothing to set up, and no prompt
  // that treats the member as unfinished (MEMBER-HOME-AND-ADMIN-VIEW.md 3.5).
  if (member.faceCheckInExcluded) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-navy-900">Face check-in</h1>
        <p className="text-base text-muted-foreground">
          You are checked in by name at every gathering. There is nothing you need to set up here.
        </p>
        <Button
          render={<Link href="/account/record">Back to your record</Link>}
          variant="outline"
          className="h-11 self-start rounded-[4px] px-6 text-base"
        />
      </div>
    );
  }

  // SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md 3: capture only follows explicit
  // consent. A member who arrives here without it, whether they
  // deferred or simply typed the address in, goes back to section 9 to
  // decide, rather than seeing a screen for something they have not
  // agreed to.
  if (!member.consentBiometric) {
    redirect("/account/record/face");
  }

  if (!member.dateOfBirth) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-navy-900">Face check-in</h1>
        <p className="text-base text-muted-foreground">
          We need your date of birth on file before this can be set up. Add it in the About you section of your
          record, then come back here.
        </p>
        <Button
          render={<Link href="/account/record/about">Go to About you</Link>}
          variant="outline"
          className="h-11 self-start rounded-[4px] px-6 text-base"
        />
      </div>
    );
  }

  if (ageInYears(member.dateOfBirth) < MINIMUM_ENROLMENT_AGE) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-navy-900">Face check-in</h1>
        {/* SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md 4.7: blocked outright, not
            merely discouraged, until the committee makes a separate
            decision about guardian consent for members under 18. */}
        <p className="text-base text-muted-foreground">
          Face check-in is not available under the age of 18. The league&apos;s committee has not yet decided how
          this should work for younger members, so it stays off until they do. You can still be checked in by
          name at any gathering.
        </p>
        <Button
          render={<Link href="/account/record">Back to your record</Link>}
          variant="outline"
          className="h-11 self-start rounded-[4px] px-6 text-base"
        />
      </div>
    );
  }

  const isEnrolled = (await prisma.faceEnrolment.count({ where: { memberId: user.memberId, isActive: true } })) > 0;
  if (isEnrolled) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-navy-900">Face check-in</h1>
        <p className="text-base text-muted-foreground">
          You&apos;re set up. You&apos;ll be marked present by face from now on, and you can still be checked in
          by name any time.
        </p>
        <WithdrawFaceEnrolmentButton />
      </div>
    );
  }

  // An earlier attempt is waiting for the office to review. Trying again
  // here would only be held again, so the member is told the same thing
  // the blocked attempt told them, and nothing more
  // (MEMBER-HOME-AND-ADMIN-VIEW.md 3.2).
  const heldForReview =
    (await prisma.faceMatchCase.count({
      where: { status: "OPEN", source: "ENROLMENT", memberAId: user.memberId },
    })) > 0;
  if (heldForReview) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-navy-900">Face check-in</h1>
        <p className="text-base text-muted-foreground">
          The office will help you set this up at the mosque. Until then you are checked in by name.
        </p>
        <Button
          render={<Link href="/account/record">Back to your record</Link>}
          variant="outline"
          className="h-11 self-start rounded-[4px] px-6 text-base"
        />
      </div>
    );
  }

  return <FaceCapture />;
}
