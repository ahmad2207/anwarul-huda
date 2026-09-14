"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { registrationSchema, registrationFormDataToRaw } from "./schema";

const PASSWORD_HASH_ROUNDS = 12;

export interface RegistrationState {
  error?: string;
  success?: boolean;
  firstName?: string;
}

export async function submitRegistration(
  _previousState: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const parsed = registrationSchema.safeParse(registrationFormDataToRaw(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const data = parsed.data;

  const wing = await prisma.wing.findUnique({ where: { id: data.wingId } });
  if (!wing) {
    return { error: "Choose a valid wing." };
  }

  const passwordHash = await bcrypt.hash(data.password, PASSWORD_HASH_ROUNDS);

  try {
    const member = await prisma.$transaction(async (tx) => {
      const created = await tx.member.create({
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
          wingId: data.wingId,
          branchId: data.branchId ?? null,
          status: "PENDING",
          source: "SELF_REGISTRATION",
          islamicEducation: data.islamicEducation ?? null,
          otherSkills: data.otherSkills ?? null,
          availability: data.availability,
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
            create: data.serviceAreaIds.map((serviceAreaId) => ({ serviceAreaId })),
          },
          household: {
            create: data.household.map((row) => ({
              fullName: row.fullName,
              age: row.age ?? null,
              relationship: row.relationship ?? null,
            })),
          },
          // Created inactive, with the password chosen here. Approval
          // only activates this same account, it does not create a
          // second one. See app/admin/approvals/actions.ts.
          user: {
            create: {
              email: data.email ?? null,
              phone: data.phone,
              passwordHash,
              isActive: false,
            },
          },
        },
      });

      await writeAudit(
        {
          actorId: null,
          action: "member.self_registered",
          entity: "Member",
          entityId: created.id,
          before: null,
          after: { status: created.status, surname: created.surname, firstName: created.firstName },
        },
        tx,
      );

      return created;
    });

    return { success: true, firstName: member.firstName };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "This phone number or email is already registered." };
    }
    return { error: "Something went wrong. Please try again." };
  }
}
