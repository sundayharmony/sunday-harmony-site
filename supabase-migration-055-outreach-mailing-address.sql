-- Migration 055 / operator-supplied CAN-SPAM postal address.
-- PREPARE ONLY. Do not apply from this change. The operator applies SQL.
--
-- User-run order:
--   1. If 053 is not applied, apply supabase-migration-053-prospect-outreach.sql first.
--   2. If 054 is not applied, apply supabase-migration-054-outreach-activation-wiring.sql.
--   3. Apply this file (055).
-- If 053 and 054 are already applied, run 055 only.
-- Does not activate send, does not approve the template, and does not rewrite 053/054.

UPDATE public.outreach_settings
SET
  physical_mailing_address = 'PO Box 1011, Jersey City, NJ 07304',
  settings_version = settings_version + 1,
  updated_at = now()
WHERE id = 1
  AND physical_mailing_address IS DISTINCT FROM 'PO Box 1011, Jersey City, NJ 07304';

UPDATE public.outreach_template_versions
SET
  approved = false,
  approved_at = null,
  approved_by = null,
  approved_settings_version = null
WHERE approved = true;
