import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canEnrolMemberFace } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { ageInYears } from "@/lib/members/age";
import { formatMemberName } from "@/lib/members/display-name";
import { formatLagosDate } from "@/lib/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { FaceCapture, type FaceCaptureCopy } from "@/app/account/face/face-capture";
import { recordConsentInPerson, saveFaceEnrolmentByOfficer } from "./actions";
import { ConsentInPersonForm } from "./consent-form";

const MINIMUM_ENROLMENT_AGE = 18;

// Officer-assisted face enrolment at the mosque
// (MEMBER-HOME-AND-ADMIN-VIEW.md 3.7), for a member whose phone cannot do
// it, who has no smartphone, or who simply needs help. The officer holds
// their own phone facing the member, so the rear camera is used.
export default async function OfficerFaceEnrolmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const officer = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const member = await prisma.member.findUnique({
    where: { id },
    select: {
      id: true,
      wingId: true,
      memberNumber: true,
      title: true,
      surname: true,
      firstName: true,
      fullNameAsWritten: true,
      dateOfBirth: true,
      consentBiometric: true,
      faceCheckInExcluded: true,
      faceEnrolments: { where: { isActive: true }, select: { enrolledAt: true }, take: 1 },
    },
  });
  if (!member || !canEnrolMemberFace(officer, member.wingId)) {
    notFound();
  }

  const name = formatMemberName(member);
  const backHref = `/admin/members/${member.id}?tab=account`;

  let body: React.ReactNode;
  if (member.faceCheckInExcluded) {
    body = (
      <p className="text-sm text-muted-foreground">
        {name} is checked in by name at every gathering, after a face match review. Face check-in is not used for them.
      </p>
    );
  } else if (!member.dateOfBirth) {
    body = (
      <p className="text-sm text-muted-foreground">
        A date of birth is needed on the record before face check-in can be set up. Add it on the Record tab first.
      </p>
    );
  } else if (ageInYears(member.dateOfBirth) < MINIMUM_ENROLMENT_AGE) {
    body = (
      <p className="text-sm text-muted-foreground">
        Face check-in is not available under the age of 18 until the committee decides how guardian consent should
        work. Check this member in by name.
      </p>
    );
  } else if (!member.consentBiometric) {
    body = <ConsentInPersonForm action={recordConsentInPerson.bind(null, member.id)} />;
  } else {
    const copy: FaceCaptureCopy = {
      title: `Set up face check-in for ${name}`,
      readyText:
        "Hold your phone facing the member at eye level, in good light. When you press Begin, read the instruction on screen to them.",
      enrolledTitle: "Set up.",
      enrolledText: `${name} will be marked present by face from now on, and can still be checked in by name any time.`,
      doneHref: backHref,
      doneLabel: "Back to the member",
      escapeHref: backHref,
      escapeLabel: "Stop and check them in by name",
      readyEscapeLabel: "Stop",
    };
    body = (
      <>
        {member.faceEnrolments[0] ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Already set up on {formatLagosDate(member.faceEnrolments[0].enrolledAt)}. Setting up again replaces it.
          </p>
        ) : null}
        <FaceCapture save={saveFaceEnrolmentByOfficer.bind(null, member.id)} camera="environment" copy={copy} />
      </>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <BackLink href={backHref} label="Back to the member" />
      <div>
        <h1 className="text-lg font-semibold">Face check-in setup</h1>
        <p className="text-sm text-muted-foreground">
          {name} &middot; {member.memberNumber ?? "No member number yet"}
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">{body}</CardContent>
      </Card>
    </div>
  );
}
