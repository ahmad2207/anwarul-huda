import { expect, test } from "@playwright/test";
import { loginAs, prisma, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from "./helpers";

const SURNAME = `E2EPayFixture${Date.now()}`;
let memberId: string;

test.beforeAll(async () => {
  const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "WOMENS" } });
  const member = await prisma.member.create({
    data: {
      surname: SURNAME,
      firstName: "Payer",
      gender: "FEMALE",
      phone: `+234701${String(Date.now()).slice(-7)}`,
      status: "ACTIVE",
      source: "ADMIN_ENTRY",
      wingId: wing.id,
    },
  });
  memberId = member.id;
});

test.afterAll(async () => {
  await prisma.payment.deleteMany({ where: { memberId } });
  await prisma.member.delete({ where: { id: memberId } });
  await prisma.$disconnect();
});

test("recording a payment leads straight to its receipt", async ({ page }) => {
  const fund = await prisma.fund.findFirstOrThrow({ where: { type: "SADAQAH", isActive: true } });

  await loginAs(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
  await page.goto("/admin/payments/new");

  await page.getByPlaceholder("Search...").fill(SURNAME);
  await page.getByRole("button", { name: new RegExp(`${SURNAME} Payer`) }).click();

  await page.getByLabel("Fund donation").check();
  await page.locator('select[name="targetId"]').selectOption(fund.id);
  await page.locator('input[name="amount"]').fill("5000");
  await page.locator('select[name="method"]').selectOption("BANK_TRANSFER");
  await page.locator('input[name="reference"]').fill(`E2E-${Date.now()}`); // required for any non cash method
  await page.getByRole("button", { name: "Record payment" }).click();

  // Not just /\/admin\/payments\/.+/: the form itself already lives at
  // /admin/payments/new, which that pattern also matches, so it would
  // resolve immediately without ever waiting for the real redirect.
  await page.waitForURL(/\/admin\/payments\/(?!new$)[^/]+$/);
  await expect(page.getByRole("heading", { name: /^Receipt / })).toBeVisible();
  // Not just getByText: the full receipt text block below also contains
  // this same string, this is the summary line specifically.
  await expect(page.locator("p", { hasText: "Amount: N5,000.00" })).toBeVisible();

  const payment = await prisma.payment.findFirstOrThrow({ where: { memberId } });
  expect(payment.amountKobo).toBe(500000);
  expect(payment.status).toBe("CONFIRMED");
  expect(payment.receiptNumber).toBeTruthy();
});
