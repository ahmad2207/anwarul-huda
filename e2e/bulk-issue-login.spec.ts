import { expect, test } from "@playwright/test";
import { loginAs, prisma, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from "./helpers";

const SURNAME = `E2EBulkIssueFixture${Date.now()}`;

let memberId: string;

test.beforeAll(async () => {
  const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
  const member = await prisma.member.create({
    data: {
      surname: SURNAME,
      firstName: "Eligible",
      gender: "MALE",
      status: "ACTIVE",
      source: "ADMIN_ENTRY",
      wingId: wing.id,
      memberNumber: `AHL/M/2026/${String(Date.now()).slice(-4)}`,
    },
  });
  memberId = member.id;
});

test.afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: "User" } }).catch(() => {});
  await prisma.user.deleteMany({ where: { memberId } });
  await prisma.member.delete({ where: { id: memberId } });
  await prisma.$disconnect();
});

test("shows the issued temporary password after bulk issuing a login", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAs(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
  await page.goto("/admin/members/bulk-issue-login");

  // Every eligible member starts selected (bulk-issue-login-form.tsx's
  // own initial state), so this fixture member is already checked; no
  // need to act on the checkbox itself.
  await page.getByRole("button", { name: /Issue login for 1 member/ }).click();

  // The temporary password is shown exactly once, right here, and is
  // never retrievable again afterwards: if this results view does not
  // stay visible, the office has no way to hand the member a password.
  await expect(page.getByText("1 login issued")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("cell", { name: /^[A-Za-z0-9]{10}$/ })).toBeVisible();
});
