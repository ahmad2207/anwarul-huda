-- Converts every remaining "timestamp without time zone" column to
-- "timestamp with time zone", so every DateTime column in the schema
-- unambiguously stores an absolute instant rather than a naive wall
-- clock reading with no timezone attached to it, matching
-- rate_limit_counters (see the previous migration) and CLAUDE.md's own
-- stated convention: "Dates are stored in UTC."
--
-- Every existing value in every column below was written through the
-- Prisma Client, never through raw SQL: verified directly (a JS Date
-- passed to Member.dateOfBirth via prisma.member.create round trips
-- through the naive column and back out losslessly, regardless of the
-- server's or the client process's local timezone), the Client
-- serialises a naive column's value as its UTC wall clock digits, not
-- the ambient session timezone's. So no existing value needs numeric
-- correction: reinterpreted as UTC, every one already reads back to the
-- exact instant it always meant.
--
-- Postgres's own default conversion when changing a column's type does
-- NOT do that. A bare "ALTER COLUMN x SET DATA TYPE TIMESTAMPTZ" with no
-- USING clause is equivalent to "x AT TIME ZONE current_setting
-- ('TIMEZONE')": it takes the naive value exactly as it already is,
-- exactly as if it were CORRECT AS UTC, and shifted it. It would have
-- reinterpreted every naive value here as being in this session's
-- timezone (Africa/Lagos on this server, confirmed via SHOW TIMEZONE),
-- moving every already-correct value back by one hour: proven directly
-- against a scratch table before writing this file, a naive
-- '2026-09-17 12:00:00' (the correct value) becomes '2026-09-17
-- 11:00:00Z' under the bare conversion Prisma generates by default, and
-- '2026-09-17 12:00:00Z' (unchanged, correct) under the explicit
-- "AT TIME ZONE 'UTC'" cast this migration uses instead. Letting the
-- default run would have been the exact one-hour corruption this
-- migration exists to rule out, applied by the migration meant to fix
-- it.
--
-- Every ALTER below is therefore explicit about which timezone the
-- existing naive value is in (UTC, not whatever the session's default
-- happens to be), rather than relying on Postgres's default, which is
-- session dependent and was already proven wrong for this data on this
-- server.

-- AlterTable
ALTER TABLE "attendance_records"
  ALTER COLUMN "checked_in_at" SET DATA TYPE TIMESTAMPTZ(3) USING "checked_in_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "audit_logs"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "biometric_devices"
  ALTER COLUMN "last_seen_at" SET DATA TYPE TIMESTAMPTZ(3) USING "last_seen_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "biometric_enrolments"
  ALTER COLUMN "enrolled_at" SET DATA TYPE TIMESTAMPTZ(3) USING "enrolled_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "branches"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "cash_sessions"
  ALTER COLUMN "opened_at" SET DATA TYPE TIMESTAMPTZ(3) USING "opened_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "closed_at" SET DATA TYPE TIMESTAMPTZ(3) USING "closed_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "charity_cases"
  ALTER COLUMN "verified_at" SET DATA TYPE TIMESTAMPTZ(3) USING "verified_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "recommended_at" SET DATA TYPE TIMESTAMPTZ(3) USING "recommended_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "approved_at" SET DATA TYPE TIMESTAMPTZ(3) USING "approved_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "content_items"
  ALTER COLUMN "delivered_on" SET DATA TYPE TIMESTAMPTZ(3) USING "delivered_on" AT TIME ZONE 'UTC',
  ALTER COLUMN "publish_at" SET DATA TYPE TIMESTAMPTZ(3) USING "publish_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "contribution_plans"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "contribution_records"
  ALTER COLUMN "period_start" SET DATA TYPE TIMESTAMPTZ(3) USING "period_start" AT TIME ZONE 'UTC',
  ALTER COLUMN "period_end" SET DATA TYPE TIMESTAMPTZ(3) USING "period_end" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "disbursements"
  ALTER COLUMN "paid_at" SET DATA TYPE TIMESTAMPTZ(3) USING "paid_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "funds"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "gatherings"
  ALTER COLUMN "starts_at" SET DATA TYPE TIMESTAMPTZ(3) USING "starts_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "ends_at" SET DATA TYPE TIMESTAMPTZ(3) USING "ends_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "import_batches"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "committed_at" SET DATA TYPE TIMESTAMPTZ(3) USING "committed_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "member_duplicate_flags"
  ALTER COLUMN "dismissed_at" SET DATA TYPE TIMESTAMPTZ(3) USING "dismissed_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "members"
  ALTER COLUMN "date_of_birth" SET DATA TYPE TIMESTAMPTZ(3) USING "date_of_birth" AT TIME ZONE 'UTC',
  ALTER COLUMN "status_at" SET DATA TYPE TIMESTAMPTZ(3) USING "status_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "approved_at" SET DATA TYPE TIMESTAMPTZ(3) USING "approved_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "payments"
  ALTER COLUMN "paid_at" SET DATA TYPE TIMESTAMPTZ(3) USING "paid_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "voided_at" SET DATA TYPE TIMESTAMPTZ(3) USING "voided_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "users"
  ALTER COLUMN "email_verified" SET DATA TYPE TIMESTAMPTZ(3) USING "email_verified" AT TIME ZONE 'UTC',
  ALTER COLUMN "last_login_at" SET DATA TYPE TIMESTAMPTZ(3) USING "last_login_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "temporary_password_issued_at" SET DATA TYPE TIMESTAMPTZ(3) USING "temporary_password_issued_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "wings"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
