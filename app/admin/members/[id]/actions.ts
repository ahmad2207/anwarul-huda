"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { canEditMemberRecords } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";
import {
  householdMemberSchema,
  memberEditSchema,
  memberFormDataToRaw,
  statusChangeSchema,
} from "./schema";

export interface ActionState {
  error?: string;
}

async function requireEditAccess(memberId: string) {
  const actor = await requireRole(["WING_ADMIN"]);
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw new Error("This member record no longer exists.");
  }
  if (!canEditMemberRecords(actor, member.wingId)) {
    throw new Error("You do not have access to edit this member.");
  }
  return { actor, member };
}

export async function updateMember(
  memberId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = memberEditSchema.safeParse(memberFormDataToRaw(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let actor;
  let before;
  try {
    ({ actor, member: before } = await requireEditAccess(memberId));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not allowed." };
  }

  const data = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.member.update({
        where: { id: memberId },
        data: {
          title: data.title ?? null,
          surname: data.surname,
          firstName: data.firstName,
          otherNames: data.otherNames ?? null,
          dateOfBirth: data.dateOfBirth ?? null,
          gender: data.gender,
          maritalStatus: data.maritalStatus ?? null,
          occupation: data.occupation ?? null,
          nationality: data.nationality ?? null,
          stateOfOrigin: data.stateOfOrigin ?? null,
          languages: data.languages,
          phone: data.phone,
          altPhone: data.altPhone ?? null,
          email: data.email ?? null,
          address: data.address ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          landmark: data.landmark ?? null,
          preferredContact: data.preferredContact ?? null,
          branchId: data.branchId ?? null,
          yearJoined: data.yearJoined ?? null,
          officeHeld: data.officeHeld ?? null,
          halaqah: data.halaqah ?? null,
          islamicEducation: data.islamicEducation ?? null,
          otherSkills: data.otherSkills ?? null,
          availability: data.availability,
          notes: data.notes ?? null,
          accessNeeds: data.accessNeeds ?? null,
          nokName: data.nokName ?? null,
          nokRelationship: data.nokRelationship ?? null,
          nokPhone: data.nokPhone ?? null,
          nokAltPhone: data.nokAltPhone ?? null,
          consentRecords: data.consentRecords,
          consentDirectory: data.consentDirectory,
          consentComms: data.consentComms,
          consentBiometric: data.consentBiometric,
          serviceAreas: {
            deleteMany: {},
            create: data.serviceAreaIds.map((serviceAreaId) => ({ serviceAreaId })),
          },
        },
      });

      await writeAudit(
        {
          actorId: actor.id,
          action: "member.updated",
          entity: "Member",
          entityId: memberId,
          before,
          after: updated,
        },
        tx,
      );
    });
  } catch {
    return { error: "Could not save these changes. Check the phone number is not already in use." };
  }

  revalidatePath(`/admin/members/${memberId}`);
  return {};
}

export async function changeMemberStatus(
  memberId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = statusChangeSchema.safeParse({
    status: formData.get("status"),
    reason: formData.get("reason"),
    effectiveDate: formData.get("effectiveDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let actor;
  let before;
  try {
    ({ actor, member: before } = await requireEditAccess(memberId));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not allowed." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.member.update({
      where: { id: memberId },
      data: {
        status: parsed.data.status,
        statusReason: parsed.data.reason,
        statusAt: parsed.data.effectiveDate ?? new Date(),
      },
    });

    await writeAudit(
      {
        actorId: actor.id,
        action: "member.status_changed",
        entity: "Member",
        entityId: memberId,
        before: { status: before.status, statusReason: before.statusReason },
        after: { status: updated.status, statusReason: updated.statusReason, statusAt: updated.statusAt },
      },
      tx,
    );
  });

  revalidatePath(`/admin/members/${memberId}`);
  return {};
}

export async function addHouseholdMember(
  memberId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = householdMemberSchema.safeParse({
    fullName: formData.get("fullName"),
    age: formData.get("age"),
    relationship: formData.get("relationship"),
    linkedMemberNumber: formData.get("linkedMemberNumber"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let actor;
  try {
    ({ actor } = await requireEditAccess(memberId));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not allowed." };
  }

  let linkedMemberId: string | null = null;
  if (parsed.data.linkedMemberNumber) {
    const linked = await prisma.member.findUnique({
      where: { memberNumber: parsed.data.linkedMemberNumber },
    });
    if (!linked) {
      return { error: `No member found with number ${parsed.data.linkedMemberNumber}.` };
    }
    linkedMemberId = linked.id;
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.householdMember.create({
      data: {
        memberId,
        fullName: parsed.data.fullName,
        age: parsed.data.age ?? null,
        relationship: parsed.data.relationship ?? null,
        linkedMemberId,
      },
    });

    await writeAudit(
      {
        actorId: actor.id,
        action: "member.household_added",
        entity: "HouseholdMember",
        entityId: created.id,
        before: null,
        after: created,
      },
      tx,
    );
  });

  revalidatePath(`/admin/members/${memberId}`);
  return {};
}

export async function updateHouseholdMember(
  memberId: string,
  householdMemberId: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = householdMemberSchema.safeParse({
    fullName: formData.get("fullName"),
    age: formData.get("age"),
    relationship: formData.get("relationship"),
    linkedMemberNumber: formData.get("linkedMemberNumber"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let actor;
  try {
    ({ actor } = await requireEditAccess(memberId));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not allowed." };
  }

  const before = await prisma.householdMember.findUnique({ where: { id: householdMemberId } });
  if (!before || before.memberId !== memberId) {
    return { error: "This household member no longer exists." };
  }

  let linkedMemberId: string | null = null;
  if (parsed.data.linkedMemberNumber) {
    const linked = await prisma.member.findUnique({
      where: { memberNumber: parsed.data.linkedMemberNumber },
    });
    if (!linked) {
      return { error: `No member found with number ${parsed.data.linkedMemberNumber}.` };
    }
    linkedMemberId = linked.id;
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.householdMember.update({
      where: { id: householdMemberId },
      data: {
        fullName: parsed.data.fullName,
        age: parsed.data.age ?? null,
        relationship: parsed.data.relationship ?? null,
        linkedMemberId,
      },
    });

    await writeAudit(
      {
        actorId: actor.id,
        action: "member.household_updated",
        entity: "HouseholdMember",
        entityId: householdMemberId,
        before,
        after: updated,
      },
      tx,
    );
  });

  revalidatePath(`/admin/members/${memberId}`);
  return {};
}

export async function deleteHouseholdMember(formData: FormData): Promise<void> {
  const memberId = String(formData.get("memberId") ?? "");
  const householdMemberId = String(formData.get("householdMemberId") ?? "");
  if (!memberId || !householdMemberId) {
    throw new Error("Missing id.");
  }

  const { actor } = await requireEditAccess(memberId);

  const before = await prisma.householdMember.findUnique({ where: { id: householdMemberId } });
  if (!before || before.memberId !== memberId) {
    throw new Error("This household member no longer exists.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.householdMember.delete({ where: { id: householdMemberId } });

    await writeAudit(
      {
        actorId: actor.id,
        action: "member.household_removed",
        entity: "HouseholdMember",
        entityId: householdMemberId,
        before,
        after: null,
      },
      tx,
    );
  });

  revalidatePath(`/admin/members/${memberId}`);
}
