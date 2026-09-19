import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status-tag";
import type { StatusTone } from "@/components/status-tag";
import { BackLink } from "@/components/back-link";
import {
  ApproveForm,
  CloseButton,
  RecommendForm,
  RejectForm,
  VerifyButton,
} from "./case-transition-forms";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  VERIFIED: "Verified",
  RECOMMENDED: "Recommended",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DISBURSED: "Disbursed",
  CLOSED: "Closed",
};

// Recommended is awaiting a decision (attention), approved and
// disbursed are both a confirmed outcome, rejected is the one alert
// state. Draft, verified and closed are just where the case is in the
// workflow, not a state that needs a colour.
const STATUS_TONES: Record<string, StatusTone> = {
  RECOMMENDED: "attention",
  APPROVED: "confirmed",
  DISBURSED: "confirmed",
  REJECTED: "alert",
};

function caseStatusTone(status: string): StatusTone {
  return STATUS_TONES[status] ?? "neutral";
}

export default async function CharityCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["CHARITY_OFFICER"]);
  const { id } = await params;

  const charityCase = await prisma.charityCase.findUnique({
    where: { id },
    include: {
      verifiedBy: true,
      recommendedBy: true,
      approvedBy: true,
      disbursements: { include: { fund: true, paidBy: true }, orderBy: { paidAt: "desc" } },
    },
  });

  if (!charityCase) {
    notFound();
  }

  const canRecommendOrApprove = charityCase.status === "RECOMMENDED";
  const selfApprovalBlocked = canRecommendOrApprove && charityCase.recommendedById === user.id;

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/admin/charity/cases" label="Back to beneficiary cases" />
      <div>
        <h1 className="text-lg font-semibold">{charityCase.reference}</h1>
        <p className="text-sm text-muted-foreground">
          {charityCase.beneficiaryName} &middot;{" "}
          <StatusTag tone={caseStatusTone(charityCase.status)}>{STATUS_LABELS[charityCase.status]}</StatusTag>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Case details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Need: </span>
            {charityCase.needDescription}
          </p>
          <p>
            <span className="text-muted-foreground">Requested: </span>
            {formatNaira(charityCase.requestedKobo)}
          </p>
          {charityCase.zakatCategory ? (
            <p>
              <span className="text-muted-foreground">Zakat category: </span>
              {charityCase.zakatCategory}
            </p>
          ) : null}
          {charityCase.recommendedKobo ? (
            <p>
              <span className="text-muted-foreground">Recommended: </span>
              {formatNaira(charityCase.recommendedKobo)} by{" "}
              {charityCase.recommendedBy?.email ?? charityCase.recommendedBy?.phone}
            </p>
          ) : null}
          {charityCase.approvedKobo ? (
            <p>
              <span className="text-muted-foreground">Approved: </span>
              {formatNaira(charityCase.approvedKobo)} by{" "}
              {charityCase.approvedBy?.email ?? charityCase.approvedBy?.phone}
            </p>
          ) : null}
          {charityCase.decisionNote ? (
            <p>
              <span className="text-muted-foreground">Decision note: </span>
              {charityCase.decisionNote}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {charityCase.status === "DRAFT" ? (
            <div className="flex flex-wrap gap-2">
              <VerifyButton caseId={charityCase.id} />
              <RejectForm caseId={charityCase.id} />
            </div>
          ) : null}

          {charityCase.status === "VERIFIED" ? (
            <div className="flex flex-wrap gap-2">
              <RecommendForm caseId={charityCase.id} />
              <RejectForm caseId={charityCase.id} />
            </div>
          ) : null}

          {charityCase.status === "RECOMMENDED" ? (
            <div className="flex flex-col gap-2">
              {selfApprovalBlocked ? (
                <p className="text-xs text-amber-800">
                  You recommended this case, so you cannot approve it. Someone else needs to.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <ApproveForm caseId={charityCase.id} />
                <RejectForm caseId={charityCase.id} />
              </div>
            </div>
          ) : null}

          {charityCase.status === "APPROVED" ? (
            <Button
              render={<Link href={`/admin/charity/disbursements/new?caseId=${charityCase.id}`}>Record a disbursement</Link>}
            />
          ) : null}

          {charityCase.status === "DISBURSED" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                render={
                  <Link href={`/admin/charity/disbursements/new?caseId=${charityCase.id}`}>
                    Record another disbursement
                  </Link>
                }
              />
              <CloseButton caseId={charityCase.id} />
            </div>
          ) : null}

          {["REJECTED", "CLOSED"].includes(charityCase.status) ? (
            <p className="text-sm text-muted-foreground">This case has been decided. No further action.</p>
          ) : null}
        </CardContent>
      </Card>

      {charityCase.disbursements.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Disbursements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {charityCase.disbursements.map((disbursement) => (
              <div key={disbursement.id} className="rounded-md border p-2 text-sm">
                {disbursement.reference} &middot; {formatNaira(disbursement.amountKobo)} from{" "}
                {disbursement.fund.name} &middot; paid by{" "}
                {disbursement.paidBy.email ?? disbursement.paidBy.phone} &middot;{" "}
                {disbursement.paidAt.toLocaleDateString("en-NG")}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
