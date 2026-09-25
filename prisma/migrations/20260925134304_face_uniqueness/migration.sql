-- CreateEnum
CREATE TYPE "FaceMatchCaseStatus" AS ENUM ('OPEN', 'SAME_PERSON', 'INDISTINGUISHABLE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "FaceMatchCaseSource" AS ENUM ('ENROLMENT', 'RETROSPECTIVE_SCAN');

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "face_check_in_excluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "face_check_in_excluded_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "match_margin" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "face_match_cases" (
    "id" TEXT NOT NULL,
    "member_a_id" TEXT NOT NULL,
    "member_b_id" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "threshold_used" DOUBLE PRECISION NOT NULL,
    "source" "FaceMatchCaseSource" NOT NULL,
    "status" "FaceMatchCaseStatus" NOT NULL DEFAULT 'OPEN',
    "decision_note" TEXT,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_match_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_check_in_refusals" (
    "id" TEXT NOT NULL,
    "gathering_id" TEXT NOT NULL,
    "best_similarity" DOUBLE PRECISION NOT NULL,
    "runner_up_similarity" DOUBLE PRECISION NOT NULL,
    "margin" DOUBLE PRECISION NOT NULL,
    "min_margin" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_check_in_refusals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "face_match_cases_status_idx" ON "face_match_cases"("status");

-- CreateIndex
CREATE INDEX "face_match_cases_member_a_id_member_b_id_idx" ON "face_match_cases"("member_a_id", "member_b_id");

-- CreateIndex
CREATE INDEX "face_check_in_refusals_created_at_idx" ON "face_check_in_refusals"("created_at");

-- AddForeignKey
ALTER TABLE "face_match_cases" ADD CONSTRAINT "face_match_cases_member_a_id_fkey" FOREIGN KEY ("member_a_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_match_cases" ADD CONSTRAINT "face_match_cases_member_b_id_fkey" FOREIGN KEY ("member_b_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_match_cases" ADD CONSTRAINT "face_match_cases_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

