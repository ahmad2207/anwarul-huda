"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireWingAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { completeIncompleteMemberSchema } from "./schema";

export async function completeIncompleteMember(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = completeIncompleteMemberSchema.safeParse({
    memberId: formData.get("memberId"),
    surname: formData.get("surname"),
    firstName: formData.get("firstName"),
    phone: formData.get("phone"),
    noPhoneOnFile: formData.get("noPhoneOnFile") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the values you entered and try again.";
  }

  const actor = await requireRole(["WING_ADMIN"]);

  const member = await prisma.member.findUnique({ where: { id: parsed.data.memberId } });
  if (!member) {
    return "This member record no longer exists.";
  }

  try {
    await requireWingAccess(member.wingId);
  } catch {
    return "You do not have access to this wing.";
  }

  if (!member.isRecordIncomplete) {
    return "This record is not on the incomplete list.";
  }

  // Never inventing a phone number here: either a real one was given, or
  // noPhoneOnFile is set and the field stays null, both enforced already
  // by the schema's refinements. Either way surname and firstName are now
  // present, so the record is complete and the flag clears.
  const updated = await prisma.member.update({
    where: { id: member.id },
    data: {
      surname: parsed.data.surname,
      firstName: parsed.data.firstName,
      phone: parsed.data.noPhoneOnFile ? null : parsed.data.phone,
      isRecordIncomplete: false,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "member.completed_incomplete_record",
    entity: "Member",
    entityId: member.id,
    before: { surname: member.surname, firstName: member.firstName, phone: member.phone },
    after: { surname: updated.surname, firstName: updated.firstName, phone: updated.phone },
  });

  revalidatePath("/admin/members/incomplete");
  revalidatePath(`/admin/members/${member.id}`);
  return undefined;
}
