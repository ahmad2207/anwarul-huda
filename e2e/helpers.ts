import type { Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import type { RoleName } from "@prisma/client";
import { prisma } from "../lib/prisma";

// Relative imports throughout this directory, not the @/ alias the app
// itself uses: these tests run under Playwright's own module resolution,
// a sibling to the app rather than part of its build, so nothing here
// assumes the alias is configured for it.

export const SUPER_ADMIN_EMAIL = "superadmin@ahl-league.test";
export const SUPER_ADMIN_PASSWORD = "ChangeMe123!";

/** Signs in through the real form, the same as a person would, and waits for the post login redirect. */
export async function loginAs(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email or phone number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin");
}

/**
 * Creates a throwaway staff account with one role, active immediately
 * (no approval flow needed for a fixture). Used where a flow's own
 * business rule requires two genuinely different people, for example the
 * separation of duty between recommending and approving a disbursement:
 * the seeded super admin alone cannot exercise that rule, since it would
 * be the same actor on both sides.
 */
export async function createStaffUser(input: { email: string; phone: string; password: string; role: RoleName }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      passwordHash,
      isActive: true,
      roles: { create: { role: input.role } },
    },
  });
}

export { prisma };
