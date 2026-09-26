"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { EnrolmentWorklistError, recordWillNotUseFaceCheckIn } from "@/lib/face/enrolment-worklist";

const declineSchema = z.object({
  memberId: z.string().trim().min(1, "Missing member."),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

export interface DeclineActionState {
  error?: string;
  done?: boolean;
}

// Role here, wing per member inside recordWillNotUseFaceCheckIn, so an
// officer cannot take another wing's member off the list by posting an id.
export async function recordWillNotUseFaceAction(
  _previous: DeclineActionState,
  formData: FormData,
): Promise<DeclineActionState> {
  const officer = await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);
  const parsed = declineSchema.safeParse({
    memberId: formData.get("memberId"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  }

  try {
    await recordWillNotUseFaceCheckIn(officer, parsed.data.memberId, parsed.data.note ?? null);
  } catch (error) {
    if (error instanceof EnrolmentWorklistError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/attendance/enrolment");
  revalidatePath(`/admin/members/${parsed.data.memberId}`);
  return { done: true };
}
