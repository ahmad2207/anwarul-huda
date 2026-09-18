-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "face_enrolments" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "liveness_score" DOUBLE PRECISION NOT NULL,
    "enrolled_at" TIMESTAMPTZ(3) NOT NULL,
    "device_label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "face_enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "face_enrolments_member_id_idx" ON "face_enrolments"("member_id");

-- AddForeignKey
ALTER TABLE "face_enrolments" ADD CONSTRAINT "face_enrolments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
-- Written by hand: Prisma's schema language has no way to declare a
-- vector index or its operator class, only Unsupported("vector(1024)")
-- for the column itself (see the comment on FaceEnrolment in
-- schema.prisma). HNSW with the cosine operator class, matching
-- SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md 3.3's "cosine similarity" for
-- matching: B2's matching query will read this column with the <=>
-- (cosine distance) operator, which is only fast with this index in
-- place, not after the fact.
CREATE INDEX "face_enrolments_embedding_idx" ON "face_enrolments" USING hnsw ("embedding" vector_cosine_ops);
