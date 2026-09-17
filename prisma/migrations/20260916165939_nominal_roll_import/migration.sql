-- CreateEnum
CREATE TYPE "ImportMode" AS ENUM ('FULL', 'NOMINAL_ROLL');

-- CreateEnum
CREATE TYPE "DuplicateFlagStatus" AS ENUM ('PENDING', 'DISMISSED');

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "mode" "ImportMode" NOT NULL DEFAULT 'FULL';

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "full_name_as_written" TEXT,
ADD COLUMN     "is_record_incomplete" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "surname" DROP NOT NULL,
ALTER COLUMN "first_name" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateTable
CREATE TABLE "member_duplicate_flags" (
    "id" TEXT NOT NULL,
    "member_a_id" TEXT NOT NULL,
    "member_b_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DuplicateFlagStatus" NOT NULL DEFAULT 'PENDING',
    "dismissed_by_id" TEXT,
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_duplicate_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_duplicate_flags_status_idx" ON "member_duplicate_flags"("status");

-- CreateIndex
CREATE INDEX "members_is_record_incomplete_idx" ON "members"("is_record_incomplete");

-- AddForeignKey
ALTER TABLE "member_duplicate_flags" ADD CONSTRAINT "member_duplicate_flags_member_a_id_fkey" FOREIGN KEY ("member_a_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_duplicate_flags" ADD CONSTRAINT "member_duplicate_flags_member_b_id_fkey" FOREIGN KEY ("member_b_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_duplicate_flags" ADD CONSTRAINT "member_duplicate_flags_dismissed_by_id_fkey" FOREIGN KEY ("dismissed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
