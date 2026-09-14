import { z } from "zod";
import { optionalField, optionalPhone, optionalText, requiredPhone, toStringList } from "@/lib/zod-helpers";

// Wing is deliberately not editable here. Re-assigning a member to a
// different wing after their member number has already been issued
// (embedding the old wing's letter) is a real business decision the spec
// treats as a committee level transfer, not a plain field edit (see
// docs/SPEC.md 1.2, youth members "flagged for transfer" rather than moved
// automatically). That workflow is not built yet, so wing changes are left
// out of this form rather than allowed to happen silently and incorrectly.
export const memberEditSchema = z.object({
  title: optionalText(20),
  surname: z.string().trim().min(1, "Surname is required").max(100),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  otherNames: optionalText(200),
  dateOfBirth: optionalField(z.coerce.date()),
  gender: z.enum(["MALE", "FEMALE"]),
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
  branchId: optionalText(50),
  yearJoined: optionalField(z.coerce.number().int().min(1900).max(2100)),
  officeHeld: optionalText(200),
  halaqah: optionalText(200),
  islamicEducation: optionalText(500),
  otherSkills: optionalText(500),
  availability: z.preprocess(toStringList, z.array(z.string().max(100))),
  notes: optionalText(1000),
  accessNeeds: optionalText(500),
  nokName: optionalText(200),
  nokRelationship: optionalText(100),
  nokPhone: optionalPhone("Next of kin phone"),
  nokAltPhone: optionalPhone("Next of kin alternative phone"),
  consentRecords: z.boolean(),
  consentDirectory: z.boolean(),
  consentComms: z.boolean(),
  consentBiometric: z.boolean(),
  serviceAreaIds: z.array(z.string()),
});

export type MemberEditInput = z.infer<typeof memberEditSchema>;

export function memberFormDataToRaw(formData: FormData) {
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
    branchId: formData.get("branchId"),
    yearJoined: formData.get("yearJoined"),
    officeHeld: formData.get("officeHeld"),
    halaqah: formData.get("halaqah"),
    islamicEducation: formData.get("islamicEducation"),
    otherSkills: formData.get("otherSkills"),
    availability: formData.get("availability"),
    notes: formData.get("notes"),
    accessNeeds: formData.get("accessNeeds"),
    nokName: formData.get("nokName"),
    nokRelationship: formData.get("nokRelationship"),
    nokPhone: formData.get("nokPhone"),
    nokAltPhone: formData.get("nokAltPhone"),
    consentRecords: formData.get("consentRecords") === "on",
    consentDirectory: formData.get("consentDirectory") === "on",
    consentComms: formData.get("consentComms") === "on",
    consentBiometric: formData.get("consentBiometric") === "on",
    serviceAreaIds: formData.getAll("serviceAreaIds"),
  };
}

export const statusChangeSchema = z.object({
  status: z.enum(["ACTIVE", "OCCASIONAL", "RELOCATED", "HONORARY", "INACTIVE", "DECEASED"]),
  reason: z.string().trim().min(3, "Give a short reason for this change.").max(500),
  effectiveDate: optionalField(z.coerce.date()),
});

export const householdMemberSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(200),
  age: optionalField(z.coerce.number().int().min(0).max(120)),
  relationship: optionalText(100),
  linkedMemberNumber: optionalText(50),
});
