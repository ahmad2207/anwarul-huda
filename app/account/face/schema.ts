import { z } from "zod";

// Matches the vector(1024) column: prisma/schema.prisma's own comment
// on FaceEnrolment explains why that column is Unsupported rather than
// a normal Prisma field, and why every read and write against it is raw
// SQL. This is the boundary that raw SQL crosses, so it is validated
// here as carefully as any other server input, not waved through
// because it also happens to be large.
const EMBEDDING_DIMENSION = 1024;

export const faceEnrolmentPayloadSchema = z.object({
  embedding: z
    .array(z.number().finite())
    .length(EMBEDDING_DIMENSION, `Expected a ${EMBEDDING_DIMENSION} number face description`),
  livenessScore: z.number().min(0).max(1),
  deviceLabel: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : undefined)),
});
