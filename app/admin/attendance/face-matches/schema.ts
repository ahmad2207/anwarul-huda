import { z } from "zod";

export const FACE_MATCH_OUTCOMES = ["SAME_PERSON", "INDISTINGUISHABLE", "DISMISSED"] as const;

export const resolveFaceMatchSchema = z.object({
  caseId: z.string().trim().min(1, "Missing case."),
  outcome: z.enum(FACE_MATCH_OUTCOMES, { message: "Choose what this pair is." }),
  note: z.string().trim().min(1, "Give a reason for the decision.").max(1000, "Keep the reason under 1,000 characters."),
});
