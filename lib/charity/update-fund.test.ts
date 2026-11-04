import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { FUND_TYPE_LOCKED_ERROR, updateFundRecord } from "./update-fund";

// Integration test against the real database: the zakat ring-fence
// depends on a fund's type never changing once money has moved.

const FIXTURE_TAG = `UpdateFundFixture${Date.now()}`;

describe("updateFundRecord", () => {
  let actorId: string;
  let memberId: string;
  let activeFundId: string;
  let emptyFundId: string;

  beforeAll(async () => {
    const actor = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: "SUPER_ADMIN" } } } });
    actorId = actor.id;

    const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
    const member = await prisma.member.create({
      data: {
        surname: FIXTURE_TAG,
        firstName: "Donor",
        gender: "MALE",
        phone: "+2348066660003",
        status: "ACTIVE",
        source: "ADMIN_ENTRY",
        wingId: wing.id,
      },
    });
    memberId = member.id;

    const activeFund = await prisma.fund.create({ data: { name: `${FIXTURE_TAG} zakat`, type: "ZAKAT" } });
    activeFundId = activeFund.id;
    await prisma.payment.create({
      data: {
        receiptNumber: `${FIXTURE_TAG}-R1`,
        memberId,
        fundId: activeFundId,
        amountKobo: 100000,
        method: "CASH",
        paidAt: new Date(),
        collectedById: actorId,
      },
    });

    const emptyFund = await prisma.fund.create({ data: { name: `${FIXTURE_TAG} empty`, type: "GENERAL" } });
    emptyFundId = emptyFund.id;
  });

  afterAll(async () => {
    const fundIds = [activeFundId, emptyFundId];
    await prisma.auditLog.deleteMany({ where: { entity: "Fund", entityId: { in: fundIds } } });
    await prisma.payment.deleteMany({ where: { memberId } });
    await prisma.fund.deleteMany({ where: { id: { in: fundIds } } });
    await prisma.member.delete({ where: { id: memberId } });
    await prisma.$disconnect();
  });

  it("refuses to change the type of a fund that has received money", async () => {
    const result = await prisma.$transaction((tx) =>
      updateFundRecord(
        tx,
        activeFundId,
        { name: `${FIXTURE_TAG} zakat`, type: "GENERAL", description: null, isActive: true },
        actorId,
      ),
    );

    expect(result).toEqual({ error: FUND_TYPE_LOCKED_ERROR });
    const fund = await prisma.fund.findUniqueOrThrow({ where: { id: activeFundId } });
    expect(fund.type).toBe("ZAKAT");
  });

  it("still allows other details of an active fund to change, and audits it", async () => {
    const result = await prisma.$transaction((tx) =>
      updateFundRecord(
        tx,
        activeFundId,
        { name: `${FIXTURE_TAG} zakat renamed`, type: "ZAKAT", description: "Updated", isActive: true },
        actorId,
      ),
    );

    expect("fund" in result).toBe(true);
    const audits = await prisma.auditLog.count({ where: { entity: "Fund", entityId: activeFundId, action: "fund.updated" } });
    expect(audits).toBe(1);
  });

  it("allows the type of a fund with no activity to change", async () => {
    const result = await prisma.$transaction((tx) =>
      updateFundRecord(
        tx,
        emptyFundId,
        { name: `${FIXTURE_TAG} empty`, type: "SADAQAH", description: null, isActive: true },
        actorId,
      ),
    );

    expect("fund" in result && result.fund.type).toBe("SADAQAH");
  });
});
