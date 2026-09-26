import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMemberName } from "@/lib/members/display-name";
import { formatLagosDate } from "@/lib/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { FaceCapture, type FaceCaptureCopy } from "@/app/account/face/face-capture";
import { saveCalibrationSample } from "../actions";

// One calibration capture (B3). The same capture and liveness check as
// enrolment and check-in, so the sample reflects what check-in really
// sees, but the save scores it and keeps only the scores.
export default async function CalibrationCapturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["SUPER_ADMIN"]);
  const params = await searchParams;
  const gatheringId = typeof params.gatheringId === "string" ? params.gatheringId : "";
  const memberId = typeof params.memberId === "string" ? params.memberId : "";

  const [gathering, member] = await Promise.all([
    gatheringId ? prisma.gathering.findUnique({ where: { id: gatheringId }, select: { id: true, title: true, startsAt: true } }) : null,
    memberId
      ? prisma.member.findUnique({
          where: { id: memberId },
          select: { id: true, title: true, surname: true, firstName: true, fullNameAsWritten: true, consentBiometric: true },
        })
      : null,
  ]);
  if (!gathering || !member) notFound();

  const name = formatMemberName(member);
  const backHref = `/admin/devices/face-calibration?gatheringId=${gathering.id}`;
  const copy: FaceCaptureCopy = {
    title: `Calibration capture: ${name}`,
    readyText:
      "Hold the phone the way an officer would at check-in, in this gathering's normal lighting. Press Begin and read the instruction to the member.",
    enrolledTitle: "Sample recorded.",
    enrolledText: "The match scores are saved. The capture itself has been discarded.",
    doneHref: backHref,
    doneLabel: "Record another",
    escapeHref: backHref,
    escapeLabel: "Back to calibration",
    readyEscapeLabel: "Cancel",
  };

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <BackLink href={backHref} label="Back to calibration" />
      <p className="text-sm text-muted-foreground">
        {gathering.title}, {formatLagosDate(gathering.startsAt)}
      </p>
      <Card>
        <CardContent className="pt-6">
          {member.consentBiometric ? (
            <FaceCapture save={saveCalibrationSample.bind(null, gathering.id, member.id)} camera="environment" copy={copy} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {name} has not agreed to face check-in, so they cannot be used for calibration.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
