import type { RecordSection } from "@prisma/client";
import { getMemberAccess, staffLabel } from "@/lib/members/member-view";
import { RECORD_SECTIONS } from "@/lib/members/record-sections";
import { formatLagosDate, formatLagosDateTime } from "@/lib/timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusTag } from "@/components/status-tag";
import { IssueLoginCard } from "./issue-login-card";

// MEMBER-HOME-AND-ADMIN-VIEW.md 2.5. Face enrolment is shown as a status
// and a date only, never the embedding. "Declined" and "flagged" from the
// spec have no state in the schema yet: section 9 offers only set up or
// defer, and flagging arrives with face uniqueness (F1).
export async function AccountTab({
  member,
  canEdit,
}: {
  member: {
    id: string;
    memberNumber: string | null;
    completedSections: RecordSection[];
    faceEnrolmentDeferred: boolean;
    faceEnrolmentDeferredAt: Date | null;
  };
  canEdit: boolean;
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
              {face.kind === "enrolled" ? (
                <StatusTag tone="confirmed">Enrolled {formatLagosDate(face.enrolledAt)}</StatusTag>
              ) : face.kind === "deferred" ? (
                <StatusTag tone="attention">
                  Deferred{face.deferredAt ? ` ${formatLagosDate(face.deferredAt)}` : ""}, to be enrolled at the mosque
                </StatusTag>
              ) : (
                "Not set up"
              )}
            </Row>
          </dl>
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
