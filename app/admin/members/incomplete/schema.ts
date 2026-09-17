import { z } from "zod";
import { optionalPhone } from "@/lib/zod-helpers";

// The quick-complete form for a nominal roll record. Surname and first
// name are always required here, the same as every other path into the
// member register, but phone is not: the office can instead check "No
// phone on file" to record, as a fact, that this person genuinely has
// none, rather than leaving the record incomplete forever waiting on a
// number that will never come. Exactly one of phone or the checkbox must
// be given, never both left empty and never a phone invented to satisfy
// the form.
export const completeIncompleteMemberSchema = z
  .object({
    memberId: z.string().min(1),
    surname: z.string().trim().min(1, "Surname is required").max(100),
    firstName: z.string().trim().min(1, "First name is required").max(100),
    phone: optionalPhone("Phone"),
    noPhoneOnFile: z.boolean(),
  })
  .refine((data) => data.noPhoneOnFile || data.phone !== undefined, {
    message: 'Enter a phone number, or check "No phone on file".',
    path: ["phone"],
  })
  .refine((data) => !(data.noPhoneOnFile && data.phone !== undefined), {
    message: 'Clear the phone number if "No phone on file" is checked.',
    path: ["phone"],
  });

export type CompleteIncompleteMemberInput = z.infer<typeof completeIncompleteMemberSchema>;
