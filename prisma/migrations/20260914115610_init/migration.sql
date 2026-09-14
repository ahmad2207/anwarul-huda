-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WingCode" AS ENUM ('MENS', 'WOMENS', 'YOUTH');

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('SUPER_ADMIN', 'WING_ADMIN', 'FINANCE_OFFICER', 'CHARITY_OFFICER', 'ATTENDANCE_OFFICER', 'CONTENT_EDITOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'OCCASIONAL', 'RELOCATED', 'HONORARY', 'INACTIVE', 'DECEASED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('PHONE_CALL', 'SMS', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "MemberSource" AS ENUM ('SELF_REGISTRATION', 'ADMIN_ENTRY', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('ONE_OFF', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'POS', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CONFIRMED', 'VOIDED');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "FundType" AS ENUM ('ZAKAT', 'SADAQAH', 'WAQF', 'GENERAL', 'APPEAL');

-- CreateEnum
CREATE TYPE "ZakatCategory" AS ENUM ('FUQARA', 'MASAKIN', 'AMILIN', 'MUALLAFAT', 'RIQAB', 'GHARIMIN', 'FI_SABILILLAH', 'IBN_SABIL');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'VERIFIED', 'RECOMMENDED', 'APPROVED', 'REJECTED', 'DISBURSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GatheringType" AS ENUM ('JUMUAH', 'TALEEM', 'WING_MEETING', 'GENERAL_MEETING', 'PROGRAMME', 'OTHER');

-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('MANUAL', 'QR_CODE', 'FINGERPRINT', 'FACE');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('FINGERPRINT', 'FACE', 'HYBRID');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('SERMON', 'WEEKLY_BOOK', 'ARTICLE', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PREVIEWED', 'COMMITTED', 'ROLLED_BACK', 'FAILED');

-- CreateTable
CREATE TABLE "wings" (
    "id" TEXT NOT NULL,
    "code" "WingCode" NOT NULL,
    "name" TEXT NOT NULL,
    "number_letter" TEXT NOT NULL,
    "min_age" INTEGER,
    "max_age" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT,
    "email_verified" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "member_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "RoleName" NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_wing_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "wing_id" TEXT NOT NULL,

    CONSTRAINT "user_wing_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "member_number" TEXT,
    "title" TEXT,
    "surname" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "other_names" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "gender" "Gender" NOT NULL,
    "marital_status" "MaritalStatus",
    "occupation" TEXT,
    "nationality" TEXT,
    "state_of_origin" TEXT,
    "languages" TEXT[],
    "photo_path" TEXT,
    "phone" TEXT NOT NULL,
    "alt_phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "landmark" TEXT,
    "preferred_contact" "ContactChannel",
    "wing_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "year_joined" INTEGER,
    "status" "MemberStatus" NOT NULL DEFAULT 'PENDING',
    "status_reason" TEXT,
    "status_at" TIMESTAMP(3),
    "office_held" TEXT,
    "halaqah" TEXT,
    "islamic_education" TEXT,
    "other_skills" TEXT,
    "availability" TEXT[],
    "notes" TEXT,
    "access_needs" TEXT,
    "nok_name" TEXT,
    "nok_relationship" TEXT,
    "nok_phone" TEXT,
    "nok_alt_phone" TEXT,
    "consent_records" BOOLEAN NOT NULL DEFAULT false,
    "consent_directory" BOOLEAN NOT NULL DEFAULT false,
    "consent_comms" BOOLEAN NOT NULL DEFAULT false,
    "consent_biometric" BOOLEAN NOT NULL DEFAULT false,
    "source" "MemberSource" NOT NULL DEFAULT 'SELF_REGISTRATION',
    "import_batch_id" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "age" INTEGER,
    "relationship" TEXT,
    "linked_member_id" TEXT,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_service_areas" (
    "member_id" TEXT NOT NULL,
    "service_area_id" TEXT NOT NULL,

    CONSTRAINT "member_service_areas_pkey" PRIMARY KEY ("member_id","service_area_id")
);

-- CreateTable
CREATE TABLE "contribution_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount_kobo" INTEGER NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "wing_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contribution_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_records" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "period_label" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "amount_due_kobo" INTEGER NOT NULL,
    "amount_paid_kobo" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contribution_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "contribution_record_id" TEXT,
    "fund_id" TEXT,
    "amount_kobo" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "narration" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paid_at" TIMESTAMP(3) NOT NULL,
    "collected_by_id" TEXT NOT NULL,
    "cash_session_id" TEXT,
    "voided_by_id" TEXT,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "opened_by_id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "opening_float_kobo" INTEGER NOT NULL DEFAULT 0,
    "closed_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "counted_cash_kobo" INTEGER,
    "expected_cash_kobo" INTEGER,
    "variance_kobo" INTEGER,
    "variance_note" TEXT,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FundType" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charity_cases" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "beneficiary_name" TEXT NOT NULL,
    "beneficiary_phone" TEXT,
    "beneficiary_address" TEXT,
    "is_member" BOOLEAN NOT NULL DEFAULT false,
    "linked_member_id" TEXT,
    "need_description" TEXT NOT NULL,
    "zakat_category" "ZakatCategory",
    "requested_kobo" INTEGER NOT NULL,
    "recommended_kobo" INTEGER,
    "approved_kobo" INTEGER,
    "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "recommended_by_id" TEXT,
    "recommended_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charity_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disbursements" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "amount_kobo" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "narration" TEXT,
    "evidence_path" TEXT,
    "paid_by_id" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gatherings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "GatheringType" NOT NULL,
    "wing_id" TEXT,
    "branch_id" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gatherings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "gathering_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "checked_in_at" TIMESTAMP(3) NOT NULL,
    "method" "CheckInMethod" NOT NULL,
    "device_id" TEXT,
    "recorded_by_id" TEXT,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "serial" TEXT NOT NULL,
    "branch_id" TEXT,
    "api_key_hash" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biometric_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_enrolments" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_user_id" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "biometric_enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "author" TEXT,
    "summary" TEXT,
    "body" TEXT,
    "file_path" TEXT,
    "cover_path" TEXT,
    "external_url" TEXT,
    "tags" TEXT[],
    "wing_id" TEXT,
    "delivered_on" TIMESTAMP(3),
    "publish_at" TIMESTAMP(3),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "error_report" JSONB,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wings_code_key" ON "wings"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_member_id_key" ON "users"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "user_wing_assignments_user_id_wing_id_key" ON "user_wing_assignments"("user_id", "wing_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_member_number_key" ON "members"("member_number");

-- CreateIndex
CREATE INDEX "members_wing_id_status_idx" ON "members"("wing_id", "status");

-- CreateIndex
CREATE INDEX "members_surname_first_name_idx" ON "members"("surname", "first_name");

-- CreateIndex
CREATE INDEX "members_phone_idx" ON "members"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "service_areas_name_key" ON "service_areas"("name");

-- CreateIndex
CREATE INDEX "contribution_records_member_id_idx" ON "contribution_records"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "contribution_records_member_id_plan_id_period_label_key" ON "contribution_records"("member_id", "plan_id", "period_label");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receipt_number_key" ON "payments"("receipt_number");

-- CreateIndex
CREATE INDEX "payments_member_id_paid_at_idx" ON "payments"("member_id", "paid_at");

-- CreateIndex
CREATE INDEX "payments_cash_session_id_idx" ON "payments"("cash_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "charity_cases_reference_key" ON "charity_cases"("reference");

-- CreateIndex
CREATE INDEX "charity_cases_status_idx" ON "charity_cases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "disbursements_reference_key" ON "disbursements"("reference");

-- CreateIndex
CREATE INDEX "disbursements_fund_id_paid_at_idx" ON "disbursements"("fund_id", "paid_at");

-- CreateIndex
CREATE INDEX "gatherings_starts_at_idx" ON "gatherings"("starts_at");

-- CreateIndex
CREATE INDEX "attendance_records_member_id_checked_in_at_idx" ON "attendance_records"("member_id", "checked_in_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_gathering_id_member_id_key" ON "attendance_records"("gathering_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "biometric_devices_serial_key" ON "biometric_devices"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "biometric_enrolments_device_id_device_user_id_key" ON "biometric_enrolments"("device_id", "device_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_items_slug_key" ON "content_items"("slug");

-- CreateIndex
CREATE INDEX "content_items_type_is_published_publish_at_idx" ON "content_items"("type", "is_published", "publish_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_wing_assignments" ADD CONSTRAINT "user_wing_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_wing_assignments" ADD CONSTRAINT "user_wing_assignments_wing_id_fkey" FOREIGN KEY ("wing_id") REFERENCES "wings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_wing_id_fkey" FOREIGN KEY ("wing_id") REFERENCES "wings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_linked_member_id_fkey" FOREIGN KEY ("linked_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_service_areas" ADD CONSTRAINT "member_service_areas_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_service_areas" ADD CONSTRAINT "member_service_areas_service_area_id_fkey" FOREIGN KEY ("service_area_id") REFERENCES "service_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_plans" ADD CONSTRAINT "contribution_plans_wing_id_fkey" FOREIGN KEY ("wing_id") REFERENCES "wings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_records" ADD CONSTRAINT "contribution_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_records" ADD CONSTRAINT "contribution_records_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "contribution_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "contribution_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contribution_record_id_fkey" FOREIGN KEY ("contribution_record_id") REFERENCES "contribution_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charity_cases" ADD CONSTRAINT "charity_cases_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charity_cases" ADD CONSTRAINT "charity_cases_recommended_by_id_fkey" FOREIGN KEY ("recommended_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charity_cases" ADD CONSTRAINT "charity_cases_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "charity_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_wing_id_fkey" FOREIGN KEY ("wing_id") REFERENCES "wings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_gathering_id_fkey" FOREIGN KEY ("gathering_id") REFERENCES "gatherings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_devices" ADD CONSTRAINT "biometric_devices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_enrolments" ADD CONSTRAINT "biometric_enrolments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_enrolments" ADD CONSTRAINT "biometric_enrolments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

