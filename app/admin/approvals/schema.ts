import { z } from "zod";

export const approveMemberSchema = z.object({
  memberId: z.string().min(1),
});

export const rejectMemberSchema = z.object({
  memberId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(3, "Give a short reason so the applicant understands why.")
    .max(500),
});
