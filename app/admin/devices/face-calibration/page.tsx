import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFaceThresholds } from "@/lib/face/threshold-settings";
import { getCalibrationReport } from "@/lib/face/calibration-report";
import type { RateWithInterval, ThresholdEvaluation } from "@/lib/face/calibration";
import { duplicateDetectionThreshold } from "@/lib/face/thresholds";
import { formatMemberName } from "@/lib/members/display-name";
import { staffLabel } from "@/lib/members/member-view";
import { formatLagosDate, formatLagosDateTime } from "@/lib/timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { StatusTag } from "@/components/status-tag";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { ThresholdForm } from "./threshold-form";

function percent(value: number | null): string {
  return value === null ? "" : `${(value * 100).toFixed(1)}%`;
}

function RateCell({ rate }: { rate: RateWithInterval }) {
  if (rate.total === 0) return <span className="text-muted-foreground">No samples</span>;
  return (
    <span className="font-mono tabular-nums">
      {rate.count} of {rate.total} ({percent(rate.rate)})
      <span className="block text-xs text-muted-foreground">
        likely {percent(rate.low)} to {percent(rate.high)}
      </span>
    </span>
  );
}

// SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md B3, super admin only. The threshold
// must come from real captures taken at the mosque in real lighting, so
// this screen collects them, shows what each threshold would have done
// with them, and says plainly when there are too few to trust.
export default async function FaceCalibrationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["SUPER_ADMIN"]);
  const params = await searchParams;
  const gatheringId = typeof params.gatheringId === "string" ? params.gatheringId : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const thresholds = await getFaceThresholds();
  const memberSearch: Prisma.MemberWhereInput | null = q
    ? {
        consentBiometric: true,
        OR: [
          { surname: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { fullNameAsWritten: { contains: q, mode: "insensitive" } },
          { memberNumber: { contains: q, mode: "insensitive" } },
        ],
      }
    : null;

  const [report, history, gatherings, candidates] = await Promise.all([
    getCalibrationReport(thresholds),
    prisma.faceThresholdSetting.findMany({
      select: {
        id: true,
        matchThreshold: true,
        minMargin: true,
        note: true,
        createdAt: true,
        changedBy: { select: { email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.gathering.findMany({
      select: { id: true, title: true, startsAt: true },
      orderBy: { startsAt: "desc" },
      take: 30,
    }),
    memberSearch
      ? prisma.member.findMany({
          where: memberSearch,
          select: {
            id: true,
            memberNumber: true,
            title: true,
            surname: true,
            firstName: true,
            fullNameAsWritten: true,
            wing: { select: { name: true } },
            _count: { select: { faceEnrolments: { where: { isActive: true } } } },
          },
          orderBy: [{ surname: "asc" }, { firstName: "asc" }],
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  const thresholdColumns: DataTableColumn<ThresholdEvaluation>[] = [
    {
      key: "threshold",
      header: "Threshold",
      cell: (row) => (
        <span className="font-mono">
          {row.threshold.toFixed(2)}
          {Math.abs(row.threshold - thresholds.matchThreshold) < 1e-9 ? (
            <span className="ml-2">
              <StatusTag tone="confirmed">In use</StatusTag>
            </span>
          ) : null}
        </span>
      ),
    },
    { key: "fr", header: "Not recognised (checked in by name instead)", cell: (row) => <RateCell rate={row.falseReject} /> },
    { key: "wp", header: "Matched to the wrong member", cell: (row) => <RateCell rate={row.wrongPerson} /> },
    { key: "sa", header: "Unenrolled member matched to someone", cell: (row) => <RateCell rate={row.strangerAccepted} /> },
  ];

  type GatheringRow = (typeof report.byGathering)[number];
  const gatheringColumns: DataTableColumn<GatheringRow>[] = [
    {
      key: "gathering",
      header: "Gathering",
      cell: (row) => (
        <>
          <p className="font-medium">{row.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatLagosDate(row.startsAt)}
            {row.branchName ? `, ${row.branchName}` : ""}
          </p>
        </>
      ),
    },
    {
      key: "calibration",
      header: "Calibration at the current threshold",
      cell: (row) =>
        row.genuineSamples === 0 ? (
          <span className="text-muted-foreground">No samples here</span>
        ) : (
          <span className="text-sm">
            {row.recognised} of {row.genuineSamples} recognised
            {row.falseRejects ? `, ${row.falseRejects} not recognised` : ""}
            {row.wrongPerson ? `, ${row.wrongPerson} wrong member` : ""}
          </span>
        ),
    },
    {
      key: "live",
      header: "Live check-in",
      cell: (row) => (
        <span className="text-sm">
          {row.faceCheckIns} by face, {row.byNameCheckIns} by name
          {row.averageMatchScore !== null ? (
            <span className="block text-xs text-muted-foreground">average match {row.averageMatchScore.toFixed(2)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "close",
      header: "Close calls",
      cell: (row) => (
        <span className="text-sm">
          {row.refusedAsTooClose} refused
          <span className="block text-xs text-muted-foreground">{row.narrowMatches} only just cleared the margin</span>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Face check-in calibration"
        description="Measure how well face check-in recognises members at the mosque, and set the threshold from that evidence."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Threshold in use</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2 text-sm">
            <p>
              Check-in threshold <span className="font-mono">{thresholds.matchThreshold.toFixed(2)}</span>, minimum margin{" "}
              <span className="font-mono">{thresholds.minMargin.toFixed(2)}</span>. New enrolments are checked for
              look-alikes at <span className="font-mono">{duplicateDetectionThreshold(thresholds.matchThreshold).toFixed(2)}</span>.
            </p>
            {thresholds.source === "default" ? (
              <StatusTag tone="attention">Uncalibrated default, never set from real data</StatusTag>
            ) : (
              <p className="text-muted-foreground">
                Set {thresholds.changedAt ? formatLagosDateTime(thresholds.changedAt) : ""} by {staffLabel(thresholds.changedBy)}:{" "}
                {thresholds.note}
              </p>
            )}
            {history.length > 0 ? (
              <details className="text-muted-foreground">
                <summary className="cursor-pointer">Earlier changes</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {history.map((setting) => (
                    <li key={setting.id}>
                      <span className="font-mono">
                        {setting.matchThreshold.toFixed(2)} / {setting.minMargin.toFixed(2)}
                      </span>{" "}
                      on {formatLagosDateTime(setting.createdAt)} by {staffLabel(setting.changedBy)}: {setting.note}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
          <ThresholdForm matchThreshold={thresholds.matchThreshold} minMargin={thresholds.minMargin} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Record a calibration sample</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            At a gathering, in its real lighting, capture a member who has agreed to face check-in. Only the match scores
            are kept, never the capture. Include some members who are not enrolled, to measure how often someone
            unenrolled would be matched to a member.
          </p>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <FormField label="Gathering" htmlFor="gatheringId">
              <select
                id="gatheringId"
                name="gatheringId"
                defaultValue={gatheringId}
                required
                className="h-8 max-w-72 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Choose the gathering you are at</option>
                {gatherings.map((gathering) => (
                  <option key={gathering.id} value={gathering.id}>
                    {gathering.title}, {formatLagosDate(gathering.startsAt)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Member name or number" htmlFor="q" className="min-w-48 flex-1">
              <Input id="q" name="q" defaultValue={q} />
            </FormField>
            <Button type="submit">Find</Button>
          </form>
          {q && gatheringId ? (
            candidates.length === 0 ? (
              <p className="text-muted-foreground">No member who has agreed to face check-in matches that search.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {candidates.map((member) => (
                  <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                    <span>
                      {formatMemberName(member)}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {member.memberNumber ?? "No member number"} &middot; {member.wing.name}
                      </span>{" "}
                      {member._count.faceEnrolments > 0 ? null : <StatusTag tone="neutral">Not enrolled</StatusTag>}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      render={
                        <Link href={`/admin/devices/face-calibration/capture?gatheringId=${gatheringId}&memberId=${member.id}`}>
                          Capture
                        </Link>
                      }
                    />
                  </li>
                ))}
              </ul>
            )
          ) : q ? (
            <p className="text-muted-foreground">Choose the gathering first.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Is there enough data?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            {report.verdict.genuineSamples} captures of {report.verdict.distinctMembers} enrolled{" "}
            {report.verdict.distinctMembers === 1 ? "member" : "members"}, and {report.verdict.strangerSamples} of members
            who are not enrolled.
          </p>
          {report.verdict.enough ? <StatusTag tone="confirmed">Enough to draw a conclusion</StatusTag> : null}
          {report.verdict.messages.map((message) => (
            <p key={message} className={message.startsWith("Too few") ? "font-medium text-foreground" : "text-muted-foreground"}>
              {message}
            </p>
          ))}
        </CardContent>
      </Card>

      <h2 className="text-base font-medium">What each threshold would have done</h2>
      <p className="-mt-2 text-sm text-muted-foreground">
        At the current margin of {thresholds.minMargin.toFixed(2)}. A higher threshold wrongly matches fewer people but
        recognises fewer too. Being matched to the wrong member is the worst outcome, because nobody notices it.
      </p>
      <DataTable
        columns={thresholdColumns}
        rows={report.rows}
        rowKey={(row) => String(row.threshold)}
        emptyMessage="No samples yet."
        alignRowsTop
      />

      <h2 className="text-base font-medium">By gathering</h2>
      <p className="-mt-2 text-sm text-muted-foreground">
        So one room or one lighting condition doing badly stands out. The 20 most recent gatherings with any face activity.
      </p>
      <DataTable
        columns={gatheringColumns}
        rows={report.byGathering}
        rowKey={(row) => row.gatheringId}
        emptyMessage="No face check-ins or calibration samples yet."
        alignRowsTop
      />
    </div>
  );
}
