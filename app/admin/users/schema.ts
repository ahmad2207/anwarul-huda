import { z } from "zod";
import { optionalPhone } from "@/lib/zod-helpers";

// Every role a staff account can hold. SUPER_ADMIN is included here on
// purpose (createStaffUserAction.ts is what actually keeps it out of a
// wing administrator's hands, not this list): the form always renders
// every option a super admin may choose from, and narrows what a wing
// administrator sees client side, but the server action is what a
// crafted request cannot get past.
export const STAFF_ROLE_OPTIONS = [
  "SUPER_ADMIN",
  "WING_ADMIN",
  "FINANCE_OFFICER",
  "CHARITY_OFFICER",
  "ATTENDANCE_OFFICER",
  "CONTENT_EDITOR",
] as const;

export const STAFF_ROLE_LABELS: Record<(typeof STAFF_ROLE_OPTIONS)[number], string> = {
  SUPER_ADMIN: "Super admin",
  WING_ADMIN: "Wing admin",
  FINANCE_OFFICER: "Finance officer",
  CHARITY_OFFICER: "Charity officer",
  ATTENDANCE_OFFICER: "Attendance officer",
  CONTENT_EDITOR: "Content editor",
};

export const createStaffUserSchema = z.object({
  email: z.string().trim().min(1, "Enter an email address").email("Not a valid email address"),
  phone: optionalPhone("Phone"),
  role: z.enum(STAFF_ROLE_OPTIONS),
  wingId: z.string().trim().optional(),
});
