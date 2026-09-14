-- Enforces the zakat ring-fence at the database level (CLAUDE.md domain
-- rule 3), in addition to the check already performed in the service
-- layer (lib/charity/record-disbursement.ts). A disbursement drawn from
-- a ZAKAT fund is rejected outright if the case it draws from has no
-- zakat category assigned.
--
-- This has to be a trigger rather than a plain CHECK constraint: the
-- rule spans two other tables (the fund's type, and the case's zakat
-- category), and a CHECK constraint can only see columns on the row
-- being written, never a joined table.

CREATE OR REPLACE FUNCTION enforce_zakat_category_on_disbursement()
RETURNS TRIGGER AS $$
DECLARE
  fund_type_value "FundType";
  case_zakat_category "ZakatCategory";
BEGIN
  SELECT type INTO fund_type_value FROM funds WHERE id = NEW.fund_id;
  SELECT zakat_category INTO case_zakat_category FROM charity_cases WHERE id = NEW.case_id;

  IF fund_type_value = 'ZAKAT' AND case_zakat_category IS NULL THEN
    RAISE EXCEPTION 'Cannot disburse from a zakat fund: case % has no zakat category assigned', NEW.case_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_zakat_category
  BEFORE INSERT OR UPDATE ON disbursements
  FOR EACH ROW
  EXECUTE FUNCTION enforce_zakat_category_on_disbursement();
