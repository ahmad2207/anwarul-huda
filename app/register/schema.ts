import { z } from "zod";
import { optionalField, optionalPhone, optionalText, requiredPhone, toStringList } from "@/lib/zod-helpers";

// Household rows collected at public registration deliberately do not
// accept a link to an existing member record. That capability exists on
// the admin side (app/admin/members/[id]), where staff can verify it. An
// anonymous public form is not the place to let someone associate
// themselves with an arbitrary existing record.
const householdRowSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  age: optionalField(z.coerce.number().int().min(0).max(120)),
  relationship: optionalText(100),
});

function parseHouseholdJson(value: unknown): unknown {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

// Office held and halaqah or usrah group are assigned by the organisation
// after someone is an active member, not chosen by an applicant, so they
// are left out of self-registration and set later from the admin side.
export const registrationSchema = z
  .object({
    title: optionalText(20),
    surname: z.string().trim().min(1, "Surname is required").max(100),
    firstName: z.string().trim().min(1, "First name is required").max(100),
    otherNames: optionalText(200),
    dateOfBirth: optionalField(z.coerce.date()),
    gender: z.enum(["MALE", "FEMALE"], { message: "Choose a gender" }),
    maritalStatus: optionalField(z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"])),
    occupation: optionalText(200),
    nationality: optionalText(100),
    stateOfOrigin: optionalText(100),
    languages: z.preprocess(toStringList, z.array(z.string().max(50))),

    phone: requiredPhone("Phone"),
    altPhone: optionalPhone("Alternative phone"),
    email: optionalField(z.string().trim().email("Not a valid email address")),
    address: optionalText(300),
    city: optionalText(100),
    state: optionalText(100),
    landmark: optionalText(200),
    preferredContact: optionalField(z.enum(["PHONE_CALL", "SMS", "WHATSAPP", "EMAIL"])),

    wingId: z.string().min(1, "Choose a wing"),
    branchId: optionalText(50),

    islamicEducation: optionalText(500),
    otherSkills: optionalText(500),
    availability: z.preprocess(toStringList, z.array(z.string().max(100))),
    serviceAreaIds: z.array(z.string()),
    accessNeeds: optionalText(500),

    nokName: optionalText(200),
    nokRelationship: optionalText(100),
    nokPhone: optionalPhone("Next of kin phone"),
    nokAltPhone: optionalPhone("Next of kin alternative phone"),

    consentRecords: z
      .boolean()
      .refine((value) => value, { message: "You must consent to your record being kept to register" }),
    consentDirectory: z.boolean(),
    consentComms: z.boolean(),
    consentBiometric: z.boolean(),

    household: z.preprocess(parseHouseholdJson, z.array(householdRowSchema)),

    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

export function registrationFormDataToRaw(formData: FormData) {
  return {
    title: formData.get("title"),
    surname: formData.get("surname"),
    firstName: formData.get("firstName"),
    otherNames: formData.get("otherNames"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    maritalStatus: formData.get("maritalStatus"),
    occupation: formData.get("occupation"),
    nationality: formData.get("nationality"),
    stateOfOrigin: formData.get("stateOfOrigin"),
    languages: formData.get("languages"),
    phone: formData.get("phone"),
    altPhone: formData.get("altPhone"),
    email: formData.get("email"),
    address: formData.get("address"),
    city: formData.get("city"),
    state: formData.get("state"),
    landmark: formData.get("landmark"),
    preferredContact: formData.get("preferredContact"),
    wingId: formData.get("wingId"),
    branchId: formData.get("branchId"),
    islamicEducation: formData.get("islamicEducation"),
    otherSkills: formData.get("otherSkills"),
    availability: formData.get("availability"),
    serviceAreaIds: formData.getAll("serviceAreaIds"),
    accessNeeds: formData.get("accessNeeds"),
    nokName: formData.get("nokName"),
    nokRelationship: formData.get("nokRelationship"),
    nokPhone: formData.get("nokPhone"),
    nokAltPhone: formData.get("nokAltPhone"),
    consentRecords: formData.get("consentRecords") === "on",
    consentDirectory: formData.get("consentDirectory") === "on",
    consentComms: formData.get("consentComms") === "on",
    consentBiometric: formData.get("consentBiometric") === "on",
    household: formData.get("household"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };
}
