import { z } from "zod";
import { optionalField, optionalPhone, optionalText } from "@/lib/zod-helpers";

const ZAKAT_CATEGORIES = [
  "FUQARA",
  "MASAKIN",
  "AMILIN",
  "MUALLAFAT",
  "RIQAB",
  "GHARIMIN",
  "FI_SABILILLAH",
  "IBN_SABIL",
] as const;

export const createCaseSchema = z.object({
  beneficiaryName: z.string().trim().min(1, "Beneficiary name is required").max(200),
  beneficiaryPhone: optionalPhone("Beneficiary phone"),
  beneficiaryAddress: optionalText(300),
  isMember: z.boolean(),
  linkedMemberId: optionalText(50),
  needDescription: z.string().trim().min(1, "Describe the need").max(2000),
  zakatCategory: optionalField(z.enum(ZAKAT_CATEGORIES)),
  requested: z.string().trim().min(1, "Requested amount is required"),
});

export function createCaseFormDataToRaw(formData: FormData) {
  return {
    beneficiaryName: formData.get("beneficiaryName"),
    beneficiaryPhone: formData.get("beneficiaryPhone"),
    beneficiaryAddress: formData.get("beneficiaryAddress"),
    isMember: formData.get("isMember") === "on",
    linkedMemberId: formData.get("linkedMemberId"),
    needDescription: formData.get("needDescription"),
    zakatCategory: formData.get("zakatCategory"),
    requested: formData.get("requested"),
  };
}

export const recommendSchema = z.object({
  recommended: z.string().trim().min(1, "Recommended amount is required"),
});

export const approveSchema = z.object({
  approved: z.string().trim().min(1, "Approved amount is required"),
  decisionNote: optionalText(500),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason for rejecting this case.").max(500),
});
