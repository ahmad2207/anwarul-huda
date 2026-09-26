-- CreateTable
CREATE TABLE "face_calibration_samples" (
    "id" TEXT NOT NULL,
    "gathering_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "genuine_similarity" DOUBLE PRECISION,
    "best_impostor_similarity" DOUBLE PRECISION,
    "second_impostor_similarity" DOUBLE PRECISION,
    "liveness_score" DOUBLE PRECISION NOT NULL,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_calibration_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_threshold_settings" (
    "id" TEXT NOT NULL,
    "match_threshold" DOUBLE PRECISION NOT NULL,
    "min_margin" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_threshold_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "face_calibration_samples_gathering_id_idx" ON "face_calibration_samples"("gathering_id");

-- CreateIndex
CREATE INDEX "face_threshold_settings_created_at_idx" ON "face_threshold_settings"("created_at");

-- AddForeignKey
ALTER TABLE "face_calibration_samples" ADD CONSTRAINT "face_calibration_samples_gathering_id_fkey" FOREIGN KEY ("gathering_id") REFERENCES "gatherings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_calibration_samples" ADD CONSTRAINT "face_calibration_samples_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_calibration_samples" ADD CONSTRAINT "face_calibration_samples_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_threshold_settings" ADD CONSTRAINT "face_threshold_settings_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

