-- AlterTable
ALTER TABLE "members" ADD COLUMN     "needs_wing_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wing_review_reason" TEXT,
ADD COLUMN     "wing_review_requested_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "members_needs_wing_review_idx" ON "members"("needs_wing_review");
