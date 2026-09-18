import { z } from "zod";
import { optionalField, optionalPhone, optionalText, toStringList } from "@/lib/zod-helpers";

// Section 1 (MEMBER-INTERFACE.md 3.4): the member splits fullNameAsWritten
// themselves. fullNameAsWritten is never part of this schema, because
// nothing here is allowed to overwrite it.
export const nameSectionSchema = z.object({
  title: optionalText(30),
  surname: z.string().trim().min(1, "Enter your surname").max(80, "Surname must be 80 characters or fewer"),
  firstName: z
    .string()
    .trim()
    .min(1, "Enter your first name")
    .max(80, "First name must be 80 characters or fewer"),
  otherNames: optionalText(120),
});

// Section 2: About you.
export const aboutSectionSchema = z.object({
  dateOfBirth: optionalField(z.coerce.date()),
  gender: z.enum(["MALE", "FEMALE"], { message: "Choose a gender" }),
  maritalStatus: optionalField(z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"])),
  occupation: optionalText(200),
  nationality: optionalText(100),
  stateOfOrigin: optionalText(100),
  languages: z.preprocess(toStringList, z.array(z.string().max(50))),
});

// Section 3: Contact details. Phone stays optional here, the same as the
// column itself: this section is also where a nominal roll import with
// genuinely no phone on file gets its first chance to add one, so a
// blank submission has to mean "I have none", not be refused outright.
export const contactSectionSchema = z.object({
  phone: optionalPhone("Phone"),
  altPhone: optionalPhone("Alternative phone"),
  email: optionalField(z.string().trim().email("Not a valid email address")),
  address: optionalText(300),
  city: optionalText(100),
  state: optionalText(100),
  landmark: optionalText(200),
  preferredContact: optionalField(z.enum(["PHONE_CALL", "SMS", "WHATSAPP", "EMAIL"])),
});

// Section 4: Household. Adding, editing and removing a row are each
// their own immediate action (see actions.ts), which import
// householdMemberSchema directly from the admin side's schema rather
// than duplicating the same row shape here.

// Section 5: Your membership. Deliberately only these three fields.
// Wing, status, member number and office held never appear in this
// schema at all: see saveMembershipSection in actions.ts, where the
// read-only guarantee actually lives, not here.
export const membershipSectionSchema = z.object({
  yearJoined: optionalField(z.coerce.number().int().min(1900).max(2100)),
  branchId: optionalText(50),
  halaqah: optionalText(100),
});

// Section 6: Service and skills.
export const serviceSectionSchema = z.object({
  islamicEducation: optionalText(500),
  otherSkills: optionalText(500),
  availability: z.preprocess(toStringList, z.array(z.string().max(100))),
  serviceAreaIds: z.array(z.string()),
});

// Section 7: Next of kin.
export const nextOfKinSectionSchema = z.object({
  nokName: optionalText(200),
  nokRelationship: optionalText(100),
  nokPhone: optionalPhone("Next of kin phone"),
  nokAltPhone: optionalPhone("Next of kin alternative phone"),
});

// Section 8: Consent. consentBiometric is section 9's own, separate
// consent (MEMBER-INTERFACE.md 3.4: "not covered by a general records
// consent") and deliberately has no place in this schema.
export const consentSectionSchema = z.object({
  consentRecords: z
    .boolean()
    .refine((value) => value, { message: "You must consent to your record being kept." }),
  consentDirectory: z.boolean(),
  consentComms: z.boolean(),
});

// Section 9, the "Set up now" outcome (MEMBER-INTERFACE.md 3.4):
// biometric data carries its own consent, separate from section 8, so
// the box must be checked before this can proceed. "I cannot do this
// now" is a separate action with no input to validate: deferring is
// not a decline, so it asks for no consent at all.
export const faceSetupSchema = z
  .object({
    consented: z.string().optional(),
  })
  .refine((data) => data.consented === "on", {
    message: "Check the box to agree before setting up face check-in.",
    path: ["consented"],
  });
