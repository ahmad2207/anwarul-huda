"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { RecordSection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { recordProgress } from "@/lib/members/record-sections";
import { householdMemberSchema } from "@/app/admin/members/[id]/schema";
import {
  nameSectionSchema,
  aboutSectionSchema,
  contactSectionSchema,
  membershipSectionSchema,
  serviceSectionSchema,
  nextOfKinSectionSchema,
  consentSectionSchema,
  faceSetupSchema,
} from "./schema";

async function currentMemberId(): Promise<{ userId: string; memberId: string }> {
  const user = await getCurrentUser();
  if (!user.memberId) {
    throw new Error("This account is not linked to a member record.");
  }
  return { userId: user.id, memberId: user.memberId };
}

// Every section save adds its own RecordSection value once, never
// twice: completedSections is read first rather than pushed
// unconditionally, so revisiting and re-saving an already completed
// section does not grow the array. Completing the ninth and last
// section clears isRecordIncomplete and opens the wing administrator's
// light review (MEMBER-INTERFACE.md 3.4, M3 #9): a review, not an
// approval, so nothing about the member's status changes here.
export async function markSectionComplete(memberId: string, userId: string, section: RecordSection): Promise<void> {
  const member = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { completedSections: true },
  });
  if (member.completedSections.includes(section)) {
    return;
  }

  const completedSections = [...member.completedSections, section];
  const isNowComplete = recordProgress(completedSections).isComplete;

  await prisma.member.update({
    where: { id: memberId },
    data: {
      completedSections: { push: section },
      ...(isNowComplete
        ? {
            isRecordIncomplete: false,
            needsWingReview: true,
            wingReviewReason: "Record completed",
            wingReviewRequestedAt: new Date(),
          }
        : {}),
    },
  });

  if (isNowComplete) {
    await writeAudit({
      actorId: userId,
      action: "member.record_completed",
      entity: "Member",
      entityId: memberId,
      before: { isRecordIncomplete: true },
      after: { isRecordIncomplete: false, needsWingReview: true },
    });
  }
}

// M3 #10: once complete, a change to phone, address or name flags the
// member on the same worklist rather than gating the change behind
// approval. The flag is a fresh reason and timestamp each time, not an
// accumulating list: an administrator reviewing the flag looks at the
// whole record, the same as the completion review does, so only the
// most recent reason needs to be legible.
async function flagWingReview(memberId: string, userId: string, reason: string): Promise<void> {
  await prisma.member.update({
    where: { id: memberId },
    data: { needsWingReview: true, wingReviewReason: reason, wingReviewRequestedAt: new Date() },
  });
  await writeAudit({
    actorId: userId,
    action: "member.flagged_for_wing_review",
    entity: "Member",
    entityId: memberId,
    before: null,
    after: { wingReviewReason: reason },
  });
}

function afterSave(): never {
  revalidatePath("/account/record");
  revalidatePath("/account");
  redirect("/account/record");
}

export async function saveNameSection(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = nameSectionSchema.safeParse({
    title: formData.get("title"),
    surname: formData.get("surname"),
    firstName: formData.get("firstName"),
    otherNames: formData.get("otherNames"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the values you entered and try again.";
  }

  const { userId, memberId } = await currentMemberId();
  const before = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { title: true, surname: true, firstName: true, otherNames: true, isRecordIncomplete: true },
  });

  await prisma.member.update({
    where: { id: memberId },
    data: {
      title: parsed.data.title ?? null,
      surname: parsed.data.surname,
      firstName: parsed.data.firstName,
      otherNames: parsed.data.otherNames ?? null,
    },
  });
  await markSectionComplete(memberId, userId, "NAME");

  // The member is the actor here, not an administrator: this is their
  // own record (CLAUDE.md point 7, every write to a member is audited).
  await writeAudit({
    actorId: userId,
    action: "member.record_section_saved",
    entity: "Member",
    entityId: memberId,
    before,
    after: parsed.data,
  });

  const nameChanged =
    (parsed.data.title ?? null) !== before.title ||
    parsed.data.surname !== before.surname ||
    parsed.data.firstName !== before.firstName ||
    (parsed.data.otherNames ?? null) !== before.otherNames;
  if (!before.isRecordIncomplete && nameChanged) {
    await flagWingReview(memberId, userId, "Name changed after the record was completed.");
  }

  afterSave();
}

export async function saveAboutSection(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = aboutSectionSchema.safeParse({
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    maritalStatus: formData.get("maritalStatus"),
    occupation: formData.get("occupation"),
    nationality: formData.get("nationality"),
    stateOfOrigin: formData.get("stateOfOrigin"),
    languages: formData.get("languages"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the values you entered and try again.";
  }

  const { userId, memberId } = await currentMemberId();
  const before = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      dateOfBirth: true,
      gender: true,
      maritalStatus: true,
      occupation: true,
      nationality: true,
      stateOfOrigin: true,
      languages: true,
    },
  });

  await prisma.member.update({
    where: { id: memberId },
    data: {
      dateOfBirth: parsed.data.dateOfBirth ?? null,
      gender: parsed.data.gender,
      maritalStatus: parsed.data.maritalStatus ?? null,
      occupation: parsed.data.occupation ?? null,
      nationality: parsed.data.nationality ?? null,
      stateOfOrigin: parsed.data.stateOfOrigin ?? null,
      languages: parsed.data.languages,
    },
  });
  await markSectionComplete(memberId, userId, "ABOUT");

  await writeAudit({
    actorId: userId,
    action: "member.record_section_saved",
    entity: "Member",
    entityId: memberId,
    before,
    after: parsed.data,
  });

  afterSave();
}

export async function saveContactSection(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = contactSectionSchema.safeParse({
    phone: formData.get("phone"),
    altPhone: formData.get("altPhone"),
    email: formData.get("email"),
    address: formData.get("address"),
    city: formData.get("city"),
    state: formData.get("state"),
    landmark: formData.get("landmark"),
    preferredContact: formData.get("preferredContact"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the values you entered and try again.";
  }

  const { userId, memberId } = await currentMemberId();
  const before = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      phone: true,
      altPhone: true,
      email: true,
      address: true,
      city: true,
      state: true,
      landmark: true,
      preferredContact: true,
      isRecordIncomplete: true,
    },
  });

  await prisma.member.update({
    where: { id: memberId },
    data: {
      phone: parsed.data.phone ?? null,
      altPhone: parsed.data.altPhone ?? null,
      email: parsed.data.email ?? null,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      state: parsed.data.state ?? null,
      landmark: parsed.data.landmark ?? null,
      preferredContact: parsed.data.preferredContact ?? null,
    },
  });
  await markSectionComplete(memberId, userId, "CONTACT");

  await writeAudit({
    actorId: userId,
    action: "member.record_section_saved",
    entity: "Member",
    entityId: memberId,
    before,
    after: parsed.data,
  });

  // M3 #10 names phone and address; email joins them, since it is the
  // office's other way of reaching a member, unlike an updated city,
  // landmark or preferred contact method, which stays the member's own
  // business and does not raise the flag.
  const changedLabels: string[] = [];
  if ((parsed.data.phone ?? null) !== before.phone) changedLabels.push("Phone");
  if ((parsed.data.email ?? null) !== before.email) changedLabels.push("Email");
  if ((parsed.data.address ?? null) !== before.address) changedLabels.push("Address");
  if (!before.isRecordIncomplete && changedLabels.length > 0) {
    await flagWingReview(memberId, userId, `${changedLabels.join(" and ")} changed after the record was completed.`);
  }

  afterSave();
}

// Section 4: Household. Each row is its own immediate action, the same
// shape as the admin side's household CRUD (app/admin/members/[id]/actions.ts),
// scoped to the signed in member's own record instead of a route
// parameter, and audited under the member as actor rather than an
// administrator.

export interface HouseholdActionState {
  error?: string;
}

export async function addOwnHouseholdMember(
  _previousState: HouseholdActionState,
  formData: FormData,
): Promise<HouseholdActionState> {
  const parsed = householdMemberSchema.safeParse({
    fullName: formData.get("fullName"),
    age: formData.get("age"),
    relationship: formData.get("relationship"),
    linkedMemberNumber: formData.get("linkedMemberNumber"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const { userId, memberId } = await currentMemberId();

  let linkedMemberId: string | null = null;
  if (parsed.data.linkedMemberNumber) {
    const linked = await prisma.member.findUnique({ where: { memberNumber: parsed.data.linkedMemberNumber } });
    if (!linked) {
      return { error: `No member found with number ${parsed.data.linkedMemberNumber}.` };
    }
    linkedMemberId = linked.id;
  }

  const created = await prisma.householdMember.create({
    data: {
      memberId,
      fullName: parsed.data.fullName,
      age: parsed.data.age ?? null,
      relationship: parsed.data.relationship ?? null,
      linkedMemberId,
    },
  });

  await writeAudit({
    actorId: userId,
    action: "member.household_added",
    entity: "HouseholdMember",
    entityId: created.id,
    before: null,
    after: created,
  });

  revalidatePath("/account/record/household");
  return {};
}

export async function updateOwnHouseholdMember(
  householdMemberId: string,
  _previousState: HouseholdActionState,
  formData: FormData,
): Promise<HouseholdActionState> {
  const parsed = householdMemberSchema.safeParse({
    fullName: formData.get("fullName"),
    age: formData.get("age"),
    relationship: formData.get("relationship"),
    linkedMemberNumber: formData.get("linkedMemberNumber"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the values you entered and try again." };
  }

  const { userId, memberId } = await currentMemberId();

  const before = await prisma.householdMember.findUnique({ where: { id: householdMemberId } });
  if (!before || before.memberId !== memberId) {
    return { error: "This household member no longer exists." };
  }

  let linkedMemberId: string | null = null;
  if (parsed.data.linkedMemberNumber) {
    const linked = await prisma.member.findUnique({ where: { memberNumber: parsed.data.linkedMemberNumber } });
    if (!linked) {
      return { error: `No member found with number ${parsed.data.linkedMemberNumber}.` };
    }
    linkedMemberId = linked.id;
  }

  const updated = await prisma.householdMember.update({
    where: { id: householdMemberId },
    data: {
      fullName: parsed.data.fullName,
      age: parsed.data.age ?? null,
      relationship: parsed.data.relationship ?? null,
      linkedMemberId,
    },
  });

  await writeAudit({
    actorId: userId,
    action: "member.household_updated",
    entity: "HouseholdMember",
    entityId: householdMemberId,
    before,
    after: updated,
  });

  revalidatePath("/account/record/household");
  return {};
}

export async function removeOwnHouseholdMember(formData: FormData): Promise<void> {
  const householdMemberId = String(formData.get("householdMemberId") ?? "");
  if (!householdMemberId) {
    throw new Error("Missing id.");
  }

  const { userId, memberId } = await currentMemberId();

  const before = await prisma.householdMember.findUnique({ where: { id: householdMemberId } });
  if (!before || before.memberId !== memberId) {
    throw new Error("This household member no longer exists.");
  }

  await prisma.householdMember.delete({ where: { id: householdMemberId } });

  await writeAudit({
    actorId: userId,
    action: "member.household_removed",
    entity: "HouseholdMember",
    entityId: householdMemberId,
    before,
    after: null,
  });

  revalidatePath("/account/record/household");
}

// The household list itself has no single "save": rows come and go
// immediately above. This is the explicit checkpoint that marks the
// section done, with or without any rows, the same as a member who
// lives alone truthfully has none to add.
export async function completeHouseholdSection(): Promise<void> {
  const { userId, memberId } = await currentMemberId();

  await writeAudit({
    actorId: userId,
    action: "member.record_section_saved",
    entity: "Member",
    entityId: memberId,
    before: null,
    after: { section: "HOUSEHOLD" },
  });
  await markSectionComplete(memberId, userId, "HOUSEHOLD");

  afterSave();
}

// Section 5: Your membership. Wing, membership status, member number
// and office held are read-only to the member (MEMBER-INTERFACE.md 3.4,
// M3 #6). That is not enforced by validating and rejecting those keys
// if a crafted request includes them: it is enforced by this function
// never reading them from formData at all, anywhere below, and by
// membershipSectionSchema (schema.ts) never declaring them as fields it
// parses. There is no wingId, status, memberNumber or officeHeld
// anywhere in this file for such a payload to reach.
export async function saveMembershipSection(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = membershipSectionSchema.safeParse({
    yearJoined: formData.get("yearJoined"),
    branchId: formData.get("branchId"),
    halaqah: formData.get("halaqah"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the values you entered and try again.";
  }

  const { userId, memberId } = await currentMemberId();
  const before = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { yearJoined: true, branchId: true, halaqah: true },
  });

  await prisma.member.update({
    where: { id: memberId },
    data: {
      yearJoined: parsed.data.yearJoined ?? null,
      branchId: parsed.data.branchId ?? null,
      halaqah: parsed.data.halaqah ?? null,
    },
  });
  await markSectionComplete(memberId, userId, "MEMBERSHIP");

  await writeAudit({
    actorId: userId,
    action: "member.record_section_saved",
    entity: "Member",
    entityId: memberId,
    before,
    after: parsed.data,
  });

  afterSave();
}

export async function saveServiceSection(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = serviceSectionSchema.safeParse({
    islamicEducation: formData.get("islamicEducation"),
    otherSkills: formData.get("otherSkills"),
    availability: formData.get("availability"),
    serviceAreaIds: formData.getAll("serviceAreaIds"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the values you entered and try again.";
  }

  const { userId, memberId } = await currentMemberId();
  const before = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      islamicEducation: true,
      otherSkills: true,
      availability: true,
      serviceAreas: { select: { serviceAreaId: true } },
    },
  });

  await prisma.$transaction([
    prisma.member.update({
      where: { id: memberId },
      data: {
        islamicEducation: parsed.data.islamicEducation ?? null,
        otherSkills: parsed.data.otherSkills ?? null,
        availability: parsed.data.availability,
      },
    }),
    // Replaced wholesale rather than diffed: a member's own list of
    // service areas is short, and this is the same approach the
    // registration form's own create-only version of this join
    // already takes for a brand new record.
    prisma.memberServiceArea.deleteMany({ where: { memberId } }),
    prisma.memberServiceArea.createMany({
      data: parsed.data.serviceAreaIds.map((serviceAreaId) => ({ memberId, serviceAreaId })),
    }),
  ]);
  await markSectionComplete(memberId, userId, "SERVICE");

  await writeAudit({
    actorId: userId,
    action: "member.record_section_saved",
    entity: "Member",
    entityId: memberId,
    before: { ...before, serviceAreaIds: before.serviceAreas.map((row) => row.serviceAreaId) },
    after: parsed.data,
  });

  afterSave();
}

export async function saveNextOfKinSection(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = nextOfKinSectionSchema.safeParse({
    nokName: formData.get("nokName"),
    nokRelationship: formData.get("nokRelationship"),
    nokPhone: formData.get("nokPhone"),
    nokAltPhone: formData.get("nokAltPhone"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the values you entered and try again.";
  }

  const { userId, memberId } = await currentMemberId();
  const before = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { nokName: true, nokRelationship: true, nokPhone: true, nokAltPhone: true },
  });

  await prisma.member.update({
    where: { id: memberId },
    data: {
      nokName: parsed.data.nokName ?? null,
      nokRelationship: parsed.data.nokRelationship ?? null,
      nokPhone: parsed.data.nokPhone ?? null,
      nokAltPhone: parsed.data.nokAltPhone ?? null,
    },
  });
  await markSectionComplete(memberId, userId, "NEXT_OF_KIN");

  await writeAudit({
    actorId: userId,
    action: "member.record_section_saved",
    entity: "Member",
    entityId: memberId,
    before,
    after: parsed.data,
  });

  afterSave();
}

export async function saveConsentSection(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = consentSectionSchema.safeParse({
    consentRecords: formData.get("consentRecords") === "on",
    consentDirectory: formData.get("consentDirectory") === "on",
    consentComms: formData.get("consentComms") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the values you entered and try again.";
  }

  const { userId, memberId } = await currentMemberId();
  const before = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { consentRecords: true, consentDirectory: true, consentComms: true },
  });

  await prisma.member.update({
    where: { id: memberId },
    data: {
      consentRecords: parsed.data.consentRecords,
      consentDirectory: parsed.data.consentDirectory,
      consentComms: parsed.data.consentComms,
    },
  });
  await markSectionComplete(memberId, userId, "CONSENT");

  await writeAudit({
    actorId: userId,
    action: "member.record_section_saved",
    entity: "Member",
    entityId: memberId,
    before,
    after: parsed.data,
  });

  afterSave();
}

// The two outcomes of section 9 live as separate actions, each its own
// form: matching how a two-outcome form is already done elsewhere in
// this app (see app/admin/charity/cases/[id]/case-transition-forms.tsx),
// rather than one form with two submit buttons distinguished by value.
//
// Both mark FACE complete. Until B1 exists to actually capture a face,
// either outcome means an officer finishes the job in person at the
// next gathering, the same destination, with different consent behind
// it. Marking only the deferral complete would make the more committed
// of the two buttons a dead end for exactly the member who engaged with
// it properly, so consentBiometric and faceEnrolmentDeferred are kept
// as clean opposites: each action is authoritative over both fields,
// not just its own, so a member who changes their mind between the two
// later never leaves them both set.

export async function setUpFaceEnrolment(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = faceSetupSchema.safeParse({ consented: formData.get("consented") ?? undefined });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the values you entered and try again.";
  }

  const { userId, memberId } = await currentMemberId();
  const before = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { consentBiometric: true, faceEnrolmentDeferred: true },
  });

  await prisma.member.update({
    where: { id: memberId },
    data: { consentBiometric: true, faceEnrolmentDeferred: false, faceEnrolmentDeferredAt: null },
  });
  await markSectionComplete(memberId, userId, "FACE");
  await writeAudit({
    actorId: userId,
    action: "member.face_enrolment_consented",
    entity: "Member",
    entityId: memberId,
    before,
    after: { consentBiometric: true, faceEnrolmentDeferred: false },
  });

  revalidatePath("/account/record");
  revalidatePath("/account");
  redirect("/account/face");
}

// Bound to useActionState the same way setUpFaceEnrolment is, for the
// same disabled-while-pending behaviour on its button, but there is
// nothing on this form to read: deferring takes no input.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function deferFaceEnrolment(
  _previousState: string | undefined,
  _formData: FormData,
): Promise<string | undefined> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const { userId, memberId } = await currentMemberId();
  const before = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { consentBiometric: true, faceEnrolmentDeferred: true },
  });

  await prisma.member.update({
    where: { id: memberId },
    data: { faceEnrolmentDeferred: true, faceEnrolmentDeferredAt: new Date(), consentBiometric: false },
  });
  await markSectionComplete(memberId, userId, "FACE");
  await writeAudit({
    actorId: userId,
    action: "member.face_enrolment_deferred",
    entity: "Member",
    entityId: memberId,
    before,
    after: { consentBiometric: false, faceEnrolmentDeferred: true },
  });

  // Not /account/face: that route now goes straight to capture for a
  // consenting member and back to this same section otherwise (B1's
  // consent gate), and consentBiometric is false immediately above, so
  // sending a member there after deferring would just bounce them
  // straight back here.
  afterSave();
}
