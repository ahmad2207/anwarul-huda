import Link from "next/link";
import type { FaceMatchCaseStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { listFaceMatchCases } from "@/lib/face/match-cases";
import { duplicateDetectionThreshold } from "@/lib/face/thresholds";
import { getFaceThresholds } from "@/lib/face/threshold-settings";
import { formatMemberName } from "@/lib/members/display-name";
import { staffLabel } from "@/lib/members/member-view";
import { formatLagosDate, formatLagosDateTime } from "@/lib/timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusTag } from "@/components/status-tag";
import { TabPager, parsePage } from "@/app/admin/members/[id]/tab-pager";
import { ResolveFaceMatchForm } from "./resolve-form";
import { ScanButton } from "./scan-button";

const PAGE_SIZE = 10;

const STATUS_TABS: Array<{ status: FaceMatchCaseStatus; label: string }> = [
  { status: "OPEN", label: "Waiting for review" },
  { status: "INDISTINGUISHABLE", label: "Different people" },
  { status: "SAME_PERSON", label: "Same person" },
  { status: "DISMISSED", label: "Not a real match" },
];

const SOURCE_LABELS = { ENROLMENT: "Blocked at enrolment", RETROSPECTIVE_SCAN: "Found by a scan" } as const;

// MEMBER-HOME-AND-ADMIN-VIEW.md 3.5. Two members and a score: no images,
// no embeddings. Super admins see every case; attendance officers see
// only pairs wholly within their own wings (listFaceMatchCases).
export default async function FaceMatchReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const reviewer = await requireRole(["ATTENDANCE_OFFICER"]);
  const params = await searchParams;
  const requested = typeof params.status === "string" ? params.status : "OPEN";
  const status = STATUS_TABS.find((tab) => tab.status === requested)?.status ?? "OPEN";
  const page = parsePage(typeof params.page === "string" ? params.page : undefined);

  const [{ cases, total }, thresholds] = await Promise.all([
    listFaceMatchCases(reviewer, { status }, { page, pageSize: PAGE_SIZE }),
    getFaceThresholds(),
  ]);
  const isSuperAdmin = reviewer.roles.includes("SUPER_ADMIN");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Face match reviews"
        description="Faces too close to another member's for check-in to tell apart. Decide whether each pair is one person or two."
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 text-sm text-muted-foreground">
          <p>
            A pair is flagged at a similarity of {duplicateDetectionThreshold(thresholds.matchThreshold).toFixed(2)} or more, just below the
            check-in threshold, because any pair above it could be confused at check-in. Twins and close relatives
            often score this high: a flag is not an accusation.
          </p>
          <p>The member whose setup was blocked was told only that the office will help. Never tell them who they matched.</p>
          {isSuperAdmin ? <ScanButton /> : null}
        </CardContent>
      </Card>

      <nav aria-label="Case status" className="flex flex-wrap gap-1 border-b">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.status}
            href={tab.status === "OPEN" ? "/admin/attendance/face-matches" : `/admin/attendance/face-matches?status=${tab.status}`}
            aria-current={tab.status === status ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab.status === status
                ? "border-navy-900 font-medium text-navy-900"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {cases.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {status === "OPEN" ? "Nothing waiting for review." : "No cases with this outcome."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cases.map((matchCase) => (
            <li key={matchCase.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base font-medium">
                    <span>Similarity {matchCase.similarity.toFixed(3)}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {SOURCE_LABELS[matchCase.source]}, {formatLagosDate(matchCase.createdAt)}. Flagged at{" "}
                      {matchCase.thresholdUsed.toFixed(2)}.
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[matchCase.memberA, matchCase.memberB].map((member, index) => (
                      <div key={member.id} className="rounded-md border bg-paper-dim p-3 text-sm">
                        <p className="text-xs text-muted-foreground">
                          {index === 0 && matchCase.source === "ENROLMENT" ? "Tried to set up" : "Enrolled"}
                        </p>
                        <Link href={`/admin/members/${member.id}`} className="font-medium underline-offset-2 hover:underline">
                          {formatMemberName(member)}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">
                          {member.memberNumber ?? "No member number"} &middot; {member.wing.name}
                        </p>
                      </div>
                    ))}
                  </div>

                  {matchCase.status === "OPEN" ? (
                    <ResolveFaceMatchForm caseId={matchCase.id} />
                  ) : (
                    <div className="text-sm">
                      <StatusTag tone="neutral">{STATUS_TABS.find((tab) => tab.status === matchCase.status)?.label}</StatusTag>
                      <p className="mt-1">{matchCase.decisionNote}</p>
                      <p className="text-xs text-muted-foreground">
                        Decided by {staffLabel(matchCase.decidedBy)}
                        {matchCase.decidedAt ? `, ${formatLagosDateTime(matchCase.decidedAt)}` : ""}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <TabPager
        basePath="/admin/attendance/face-matches"
        params={status === "OPEN" ? {} : { status }}
        pageParam="page"
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
