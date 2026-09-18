-- CreateEnum
CREATE TYPE "RecordSection" AS ENUM ('NAME', 'ABOUT', 'CONTACT', 'HOUSEHOLD', 'MEMBERSHIP', 'SERVICE', 'NEXT_OF_KIN', 'CONSENT', 'FACE');

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "completed_sections" "RecordSection"[] DEFAULT ARRAY[]::"RecordSection"[],
ADD COLUMN     "face_enrolment_deferred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "face_enrolment_deferred_at" TIMESTAMPTZ(3);
