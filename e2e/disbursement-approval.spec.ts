import { expect, test } from "@playwright/test";
import { createStaffUser, loginAs, prisma, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from "./helpers";

const TAG = `E2EDisburseFixture${Date.now()}`;
// Login looks accounts up by identifier.toLowerCase(), so a mixed case
// stored email could never actually be signed in with.
const CHARITY_OFFICER_EMAIL = `${TAG.toLowerCase()}@example.test`;
const CHARITY_OFFICER_PASSWORD = "correct horse battery staple";

let charityOfficerId: string;
let caseId: string;

test.afterAll(async () => {
  await prisma.disbursement.deleteMany({ where: { case: { beneficiaryName: TAG } } });
  await prisma.charityCase.deleteMany({ where: { beneficiaryName: TAG } });
  await prisma.user.deleteMany({ where: { id: charityOfficerId } });
  await prisma.$disconnect();
});

test("a case moves from recommended to disbursed, and recommender cannot also approve", async ({ page }) => {
  const charityOfficer = await createStaffUser({
    email: CHARITY_OFFICER_EMAIL,
    phone: `+234702${String(Date.now()).slice(-7)}`,
    password: CHARITY_OFFICER_PASSWORD,
    role: "CHARITY_OFFICER",
  });
  charityOfficerId = charityOfficer.id;

  const fund = await prisma.fund.findFirstOrThrow({ where: { type: "SADAQAH", isActive: true } });

  // The charity officer creates the case, verifies it, and recommends an
  // amount. This is the "recommend" side of the separation of duty rule.
  await loginAs(page, CHARITY_OFFICER_EMAIL, CHARITY_OFFICER_PASSWORD);
  await page.goto("/admin/charity/cases/new");
  await page.locator('input[name="beneficiaryName"]').fill(TAG);
  await page.locator('textarea[name="needDescription"]').fill("Assistance with a medical bill.");
  await page.locator('input[name="requested"]').fill("20000");
  await page.getByRole("button", { name: "Create case" }).click();

  // Not just /\/admin\/charity\/cases\/.+/: the form itself already
  // lives at .../cases/new, which that pattern also matches trivially,
  // resolving before the real post creation redirect ever happens.
  await page.waitForURL(/\/admin\/charity\/cases\/(?!new$)[^/]+$/);
  caseId = page.url().split("/").pop()!;

  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Verified")).toBeVisible();

  await page.locator('input[name="recommended"]').fill("15000");
  await page.getByRole("button", { name: "Recommend", exact: true }).click();
  // Not just "Recommended" alone: the page also shows a separate
  // "Recommended: N150.00 by ..." line once an amount is set, which
  // would otherwise make this match two elements.
  await expect(page.getByText(`${TAG} · Recommended`)).toBeVisible();

  // The approve side of the rule: the same person who recommended cannot
  // also approve, which the case page itself warns about.
  await expect(
    page.getByText("You recommended this case, so you cannot approve it."),
  ).toBeVisible();

  // A genuinely different person, a super admin, does the approving.
  await loginAs(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
  await page.goto(`/admin/charity/cases/${caseId}`);
  await expect(
    page.getByText("You recommended this case, so you cannot approve it."),
  ).toHaveCount(0);

  await page.locator('input[name="approved"]').fill("15000");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText(`${TAG} · Approved`)).toBeVisible();

  await page.getByRole("link", { name: "Record a disbursement" }).click();
  await page.waitForURL(/\/admin\/charity\/disbursements\/new/);

  await page.locator('select[name="fundId"]').selectOption(fund.id);
  await page.locator('input[name="amount"]').fill("15000");
  await page.getByRole("button", { name: "Record disbursement" }).click();

  await page.waitForURL(new RegExp(`/admin/charity/cases/${caseId}$`));
  await expect(page.getByText("Disbursed")).toBeVisible();

  const finalCase = await prisma.charityCase.findUniqueOrThrow({ where: { id: caseId } });
  expect(finalCase.status).toBe("DISBURSED");
  expect(finalCase.recommendedById).toBe(charityOfficerId);
  expect(finalCase.approvedById).not.toBe(finalCase.recommendedById);
});
