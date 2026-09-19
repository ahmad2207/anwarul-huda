"use server";

import { revalidatePath } from "next/cache";
import type { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  CreateStaffUserError,
  WING_ADMIN_CREATABLE_ROLES,
  WING_SCOPED_ROLES,
  createStaffUser,
} from "@/lib/staff/create-staff-user";
import { createStaffUserSchema } from "./schema";

export interface CreateStaffUserState {
  error?: string;
  result?: {
    email: string;
    role: RoleName;
    temporaryPassword: string;
  };
}

/**
 * A super admin may create any role, for any wing a wing scoped role
 * needs. A wing administrator may only create WING_ADMIN or
 * ATTENDANCE_OFFICER, and only for a wing they themselves are assigned
 * to: FINANCE_OFFICER, CHARITY_OFFICER and CONTENT_EDITOR see every
 * wing regardless of wing assignment (lib/authorization.ts's
 * canViewAllWings), so granting one of those is a real privilege jump
 * beyond a wing administrator's own scope, kept super-admin-only. The
 * form narrows what it offers a wing administrator client side; this is
 * what a crafted request cannot get past.
 */
export async function createStaffUserAction(
  _previousState: CreateStaffUserState,
  formData: FormData,
): Promise<CreateStaffUserState> {
  const actor = await requireRole(["SUPER_ADMIN", "WING_ADMIN"]);
  const isSuperAdmin = actor.roles.includes("SUPER_ADMIN");

  const parsed = createStaffUserSchema.safeParse({
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
    wingId: formData.get("wingId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }
  const { email, phone, role, wingId } = parsed.data;

  if (!isSuperAdmin) {
    if (!WING_ADMIN_CREATABLE_ROLES.includes(role)) {
      return { error: "You can only create wing admin or attendance officer accounts." };
    }
    if (!wingId || !actor.wingIds.includes(wingId)) {
      return { error: "You can only create an account for your own wing." };
    }
  }

  if (WING_SCOPED_ROLES.includes(role) && !wingId) {
    return { error: "Choose a wing for this role." };
  }

  try {
    const result = await prisma.$transaction((tx) =>
      createStaffUser(tx, { email, phone, role, wingId }, actor.id),
    );
    revalidatePath("/admin/users");
    return { result: { email, role, temporaryPassword: result.temporaryPassword } };
  } catch (error) {
    return { error: error instanceof CreateStaffUserError ? error.message : "Could not create this account." };
  }
}
