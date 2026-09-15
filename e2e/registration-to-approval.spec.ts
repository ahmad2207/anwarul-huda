import { expect, test } from "@playwright/test";
import { loginAs, prisma, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from "./helpers";

const SURNAME = `E2ERegFixture${Date.now()}`;
const PHONE = `080${String(Date.now()).slice(-8)}`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { phone: `+234${PHONE.slice(1)}` } });
  await prisma.member.deleteMany({ where: { surname: SURNAME } });
  await prisma.$disconnect();
});

test("a public registration can be approved into an active member with an issued number", async ({ page }) => {
  const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });

  await page.goto("/register");
  await page.getByLabel("Surname", { exact: true }).fill(SURNAME);
  await page.getByLabel("First name", { exact: true }).fill("Applicant");
  await page.getByLabel("Gender", { exact: true }).selectOption("MALE");
  // "Phone" is also the label of the next of kin's phone field further
  // down, so this is scoped to the Contact fieldset specifically.
  await page.getByRole("group", { name: "Contact" }).getByLabel("Phone", { exact: true }).fill(PHONE);
  await page.getByLabel("Wing", { exact: true }).selectOption(wing.id);
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
  await page.getByLabel("Confirm password", { exact: true }).fill("correct horse battery staple");
  await page.getByLabel("I consent to my record being kept (required)").check();
  await page.getByRole("button", { name: "Register", exact: true }).click();

  await expect(page.getByText("Your registration has been received.")).toBeVisible();

  const pending = await prisma.member.findFirstOrThrow({ where: { surname: SURNAME } });
  expect(pending.status).toBe("PENDING");
  expect(pending.memberNumber).toBeNull();

  await loginAs(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
  await page.goto("/admin/approvals");

  // Matched by the name cell itself, not just any text in the row: a
  // "possible duplicate" list in another row's Duplicates column can
  // legitimately quote another pending member's full name too, which a
  // plain hasText filter on the whole row would also match.
  const nameCell = page.getByRole("cell", { name: `${SURNAME} Applicant`, exact: true });
  const row = nameCell.locator("xpath=ancestor::tr[1]");
  await row.getByRole("button", { name: "Approve" }).click();

  // The approved card leaves the pending queue once the action completes.
  await expect(page.getByText(`${SURNAME} Applicant`)).toHaveCount(0);

  const approved = await prisma.member.findUniqueOrThrow({ where: { id: pending.id } });
  expect(approved.status).toBe("ACTIVE");
  expect(approved.memberNumber).not.toBeNull();

  const user = await prisma.user.findFirst({ where: { memberId: approved.id } });
  expect(user?.isActive).toBe(true);
});
