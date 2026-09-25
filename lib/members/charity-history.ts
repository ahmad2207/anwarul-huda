import type { CaseStatus, RoleName, ZakatCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canViewCharityHistory } from "@/lib/authorization";

// The member's charity beneficiary history, for the admin member view
// (MEMBER-HOME-AND-ADMIN-VIEW.md 2.7). The permission check lives here,
// in the only function that reads this data, not only on the page that
// renders it: no caller can get the rows without passing it.

export class CharityHistoryAccessError extends Error {
  constructor() {
    super("Only charity officers and super administrators can see a member's charity history");
    this.name = "CharityHistoryAccessError";
  }
}

export interface MemberCharityCaseRow {
  id: string;
  reference: string;
  status: CaseStatus;
  zakatCategory: ZakatCategory | null;
  requestedKobo: number;
  approvedKobo: number | null;
  disbursedKobo: number;
  createdAt: Date;
}

export async function getMemberCharityHistory(
  viewer: { roles: RoleName[] },
  memberId: string,
): Promise<MemberCharityCaseRow[]> {
  if (!canViewCharityHistory(viewer)) {
    throw new CharityHistoryAccessError();
  }

  const cases = await prisma.charityCase.findMany({
    where: { linkedMemberId: memberId },
    select: {
      id: true,
      reference: true,
      status: true,
      zakatCategory: true,
      requestedKobo: true,
      approvedKobo: true,
      createdAt: true,
      disbursements: { select: { amountKobo: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return cases.map(({ disbursements, ...charityCase }) => ({
    ...charityCase,
    disbursedKobo: disbursements.reduce((sum, disbursement) => sum + disbursement.amountKobo, 0),
  }));
}
