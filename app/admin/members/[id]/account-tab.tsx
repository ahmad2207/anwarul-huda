import Link from "next/link";
import type { RecordSection } from "@prisma/client";
import { getMemberAccess, staffLabel } from "@/lib/members/member-view";
import { RECORD_SECTIONS } from "@/lib/members/record-sections";
import { formatLagosDate, formatLagosDateTime } from "@/lib/timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status-tag";
import { DeclineFaceForm } from "@/app/admin/attendance/enrolment/decline-form";
import { IssueLoginCard } from "./issue-login-card";

// MEMBER-HOME-AND-ADMIN-VIEW.md 2.5. Face enrolment is shown as a status
// and a date only, never the embedding. "Flagged" is shown as waiting for
// a face match review, without naming the other member. "Declined" has
// no state in the schema: section 9 offers only set up or defer.
export async function AccountTab({
  member,
  canEdit,
  canEnrolFace,
}: {
  member: {
    id: string;
    memberNumber: string | null;
    completedSections: RecordSection[];
    faceEnrolmentDeferred: boolean;
    faceEnrolmentDeferredAt: Date | null;
    faceCheckInExcluded: boolean;
    faceCheckInExcludedAt: Date | null;
  };
  canEdit: boolean;
  /** Whether this viewer may set up face check-in for the member in person. */
  canEnrolFace: boolean;
}) {
  const { user, face, lockout } = await getMemberAccess(member);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Login</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {user ? (
            <dl className="flex flex-col gap-1 text-sm">
              <Row label="Account">{user.isActive ? "Active" : <StatusTag tone="neutral">Deactivated</StatusTag>}</Row>
              <Row label="Login issued">
                {user.temporaryPasswordIssuedAt
                  ? `${formatLagosDate(user.temporaryPasswordIssuedAt)} by ${staffLabel(user.temporaryPasswordIssuedBy)}`
                  : `Account created ${formatLagosDate(user.createdAt)}`}
              </Row>
              <Row label="Last login">{user.lastLoginAt ? formatLagosDateTime(user.lastLoginAt) : "Never"}</Row>
              <Row label="Password">
                {user.mustChangePassword ? (
                  <StatusTag tone="attention">Still the temporary one</StatusTag>
                ) : (
                  "Changed by the member"
                )}
              </Row>
              <Row label="Lockout">
                {lockout.locked ? (
                  <StatusTag tone="alert">
                    Locked for about {Math.ceil((lockout.retryAfterSeconds ?? 60) / 60)} more minutes
                  </StatusTag>
                ) : (
                  "Not locked"
                )}
              </Row>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No login has been issued for this member.</p>
          )}
          {canEdit ? (
            <IssueLoginCard
              memberId={member.id}
              memberNumber={member.memberNumber}
              hasAccount={user !== null}
              mustChangePassword={user?.mustChangePassword ?? false}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Record and face check-in</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <dl className="flex flex-col gap-1 text-sm">
            <Row label="Face check-in">
              {face.kind === "excluded" ? (
                <StatusTag tone="neutral">
                  Checked in by name{face.excludedAt ? ` since ${formatLagosDate(face.excludedAt)}` : ""}
                  {face.reason === "review" ? ", after a face match review" : ", will not use face check-in"}
                </StatusTag>
              ) : face.kind === "enrolled" ? (
                <StatusTag tone="confirmed">Enrolled {formatLagosDate(face.enrolledAt)}</StatusTag>
              ) : face.kind === "held_for_review" ? (
                <StatusTag tone="attention">Setup held for a face match review</StatusTag>
              ) : face.kind === "deferred" ? (
                <StatusTag tone="attention">
                  Deferred{face.deferredAt ? ` ${formatLagosDate(face.deferredAt)}` : ""}, to be enrolled at the mosque
                </StatusTag>
              ) : (
                "Not set up"
              )}
            </Row>
          </dl>
          {canEnrolFace && face.kind !== "excluded" && face.kind !== "held_for_review" ? (
            <div className="flex flex-col items-start gap-1">
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link href={`/admin/members/${member.id}/face`}>
                    {face.kind === "enrolled" ? "Set up face check-in again" : "Set up face check-in with the member"}
                  </Link>
                }
              />
              {face.kind !== "enrolled" ? <DeclineFaceForm memberId={member.id} /> : null}
            </div>
          ) : null}
          <div>
            <p className="text-sm font-medium">
              Record: {RECORD_SECTIONS.filter((section) => member.completedSections.includes(section.section)).length} of{" "}
              {RECORD_SECTIONS.length} sections completed by the member
            </p>
            <ul className="mt-1 flex flex-col gap-0.5 text-sm">
              {RECORD_SECTIONS.map((section) => (
                <li key={section.key} className="flex justify-between gap-4">
                  <span>
                    {section.order}. {section.label}
                  </span>
                  <span className="text-muted-foreground">
                    {member.completedSections.includes(section.section) ? "Done" : "Not yet"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
