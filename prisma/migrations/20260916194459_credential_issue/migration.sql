-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "temporary_password_issued_at" TIMESTAMP(3),
ADD COLUMN     "temporary_password_issued_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_temporary_password_issued_by_id_fkey" FOREIGN KEY ("temporary_password_issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
