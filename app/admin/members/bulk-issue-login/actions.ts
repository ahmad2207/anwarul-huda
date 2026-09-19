"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { canEditMemberRecords, canViewAllWings } from "@/lib/authorization";
import { formatMemberName } from "@/lib/members/display-name";
import { IssueLoginError, issueLoginForMember } from "@/lib/members/issue-login";

export interface BulkIssueRowResult {
  memberId: string;
  memberName: string;
  memberNumber: string | null;
  temporaryPassword: string;
}

export interface BulkIssueRowError {
  memberId: string;
  memberName: string;
  error: string;
}

export interface BulkIssueLoginState {
  error?: string;
  issued?: BulkIssueRowResult[];
  failed?: BulkIssueRowError[];
}

/**
 * Issues a login for every selected member, one at a time, each in its
 * own transaction: a failure partway through (a wing the actor lost
 * access to since the page loaded, a member somehow already issued a
 * login in another tab) reports against that one member and moves on,
 * rather than rolling back everyone who came before it in the same
 * click. Every result here, like the single member action this shares
 * its core logic with (lib/members/issue-login.ts), carries the
 * temporary password only in this direct response, never persisted or
 * logged in plain text.
 */
export async function bulkIssueLogin(
  _previousState: BulkIssueLoginState,
  formData: FormData,
): Promise<BulkIssueLoginState> {
  const actor = await requireRole(["WING_ADMIN"]);

  const memberIds = Array.from(new Set(formData.getAll("memberIds").map(String).filter(Boolean)));
  if (memberIds.length === 0) {
    return { error: "Select at least one member." };
  }

  const members = await prisma.member.findMany({
    where: { id: { in: memberIds } },
    include: { user: true },
  });

  const issued: BulkIssueRowResult[] = [];
  const failed: BulkIssueRowError[] = [];

  for (const member of members) {
    const memberName = formatMemberName(member);

    if (!canEditMemberRecords(actor, member.wingId)) {
      failed.push({ memberId: member.id, memberName, error: "You do not have access to this member's wing." });
      continue;
    }

    try {
      const result = await prisma.$transaction((tx) => issueLoginForMember(tx, member, actor.id));
      issued.push({
        memberId: member.id,
        memberName,
        memberNumber: member.memberNumber,
        temporaryPassword: result.temporaryPassword,
      });
    } catch (error) {
      failed.push({
        memberId: member.id,
        memberName,
        error: error instanceof IssueLoginError ? error.message : "Could not issue a login for this member.",
      });
    }
  }

  revalidatePath("/admin/members/bulk-issue-login");
  revalidatePath("/admin/members/incomplete");

  return { issued, failed };
}

export type BulkReissueState = BulkIssueLoginState;

/**
 * Reissues a fresh temporary password for every member in the actor's
 * wing scope who already has a login, no selection: the "everyone, no
 * exceptions" action for when an earlier batch's passwords were never
 * printed or written down and are gone for good, by design, the moment
 * that page was left. issueLoginForMember already overwrites
 * passwordHash outright on a reissue, so the old password stops working
 * the instant this commits, for every member it touches.
 */
export async function bulkReissueAllLogins(): Promise<BulkReissueState> {
  const actor = await requireRole(["WING_ADMIN"]);
  const wingScope = canViewAllWings(actor) ? {} : { wingId: { in: actor.wingIds } };

  const members = await prisma.member.findMany({
    where: { ...wingScope, user: { isNot: null } },
    include: { user: true },
  });

  const issued: BulkIssueRowResult[] = [];
  const failed: BulkIssueRowError[] = [];

  for (const member of members) {
    const memberName = formatMemberName(member);

    try {
      const result = await prisma.$transaction((tx) => issueLoginForMember(tx, member, actor.id));
      issued.push({
        memberId: member.id,
        memberName,
        memberNumber: member.memberNumber,
        temporaryPassword: result.temporaryPassword,
      });
    } catch (error) {
      failed.push({
        memberId: member.id,
        memberName,
        error: error instanceof IssueLoginError ? error.message : "Could not reissue a login for this member.",
      });
    }
  }

  revalidatePath("/admin/members/bulk-issue-login");

  return { issued, failed };
}
