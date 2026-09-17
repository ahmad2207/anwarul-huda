"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { canEditMemberRecords } from "@/lib/authorization";
import { formatMemberName } from "@/lib/members/display-name";
import { IssueLoginError, issueLoginForMember } from "@/lib/members/issue-login";

async function requireMemberAccess(memberId: string) {
  const actor = await requireRole(["WING_ADMIN"]);
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { user: true },
  });
  if (!member) {
    throw new Error("This member record no longer exists.");
  }
  if (!canEditMemberRecords(actor, member.wingId)) {
    throw new Error("You do not have access to this member.");
  }
  return { actor, member };
}

export interface IssueLoginState {
  error?: string;
  /**
   * The plaintext temporary password. Present only in the direct response
   * to the request that generated it, held only in the browser's memory
   * from there. See lib/members/issue-login.ts for where this comes from
   * and what never happens to it afterwards.
   */
  temporaryPassword?: string;
  memberName?: string;
  memberNumber?: string | null;
}

// Bound to useActionState the same way every other action on this page
// is, for the same reason: it is how the temporary password this returns
// gets from the server back into the client's state to be shown once.
// There is nothing on the form itself to read, unlike a status change or
// a reissue's siblings here, so both parameters below go unused.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function issueLogin(
  memberId: string,
  _previousState: IssueLoginState,
  _formData: FormData,
): Promise<IssueLoginState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  let actor;
  let member;
  try {
    ({ actor, member } = await requireMemberAccess(memberId));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "You do not have permission to do this." };
  }

  let temporaryPassword: string;
  try {
    ({ temporaryPassword } = await prisma.$transaction((tx) => issueLoginForMember(tx, member, actor.id)));
  } catch (error) {
    if (error instanceof IssueLoginError) {
      return { error: error.message };
    }
    return { error: "Could not issue a login for this member." };
  }

  revalidatePath(`/admin/members/${memberId}`);

  return {
    temporaryPassword,
    memberName: formatMemberName(member),
    memberNumber: member.memberNumber,
  };
}
