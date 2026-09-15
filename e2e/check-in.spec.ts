import { expect, test } from "@playwright/test";
import { loginAs, prisma, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from "./helpers";

const SURNAME = `E2ECheckInFixture${Date.now()}`;
const GATHERING_TITLE = `${SURNAME} gathering`;

let memberId: string;
let gatheringId: string;

test.beforeAll(async () => {
  const wing = await prisma.wing.findUniqueOrThrow({ where: { code: "MENS" } });
  const member = await prisma.member.create({
    data: {
      surname: SURNAME,
      firstName: "Attendee",
      gender: "MALE",
      phone: `+234703${String(Date.now()).slice(-7)}`,
      status: "ACTIVE",
      source: "ADMIN_ENTRY",
      wingId: wing.id,
    },
  });
  memberId = member.id;
});

test.afterAll(async () => {
  await prisma.attendanceRecord.deleteMany({ where: { memberId } });
  if (gatheringId) {
    await prisma.gathering.delete({ where: { id: gatheringId } }).catch(() => {});
  }
  await prisma.member.delete({ where: { id: memberId } });
  await prisma.$disconnect();
});

function nowAsLocalDateTimeValue(): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test("checking a member in at a gathering raises the count and shows them as checked in", async ({ page }) => {
  await loginAs(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

  await page.goto("/admin/attendance");
  await page.locator('input[name="title"]').fill(GATHERING_TITLE);
  await page.locator('input[name="startsAt"]').fill(nowAsLocalDateTimeValue());
  await page.getByRole("button", { name: "Create gathering" }).click();

  const gatheringLink = page.getByRole("link", { name: GATHERING_TITLE });
  await expect(gatheringLink).toBeVisible();
  const href = await gatheringLink.getAttribute("href");
  gatheringId = href!.split("/").pop()!;

  await gatheringLink.click();
  await page.waitForURL(new RegExp(`/admin/attendance/${gatheringId}$`));

  // The running count, not just any "0" or "1" on the page.
  const count = page.locator("p.text-2xl.font-semibold");
  await expect(count).toHaveText("0");

  await page.getByPlaceholder("Search name or member number").fill(SURNAME);
  await page.getByRole("button", { name: new RegExp(SURNAME) }).click();

  await expect(count).toHaveText("1");
  await expect(page.getByText(`${SURNAME} Attendee`)).toBeVisible();

  const record = await prisma.attendanceRecord.findFirstOrThrow({ where: { memberId, gatheringId } });
  expect(record.method).toBe("MANUAL");
});
