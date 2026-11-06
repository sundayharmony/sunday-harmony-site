/** Additive 054 + 055 statements. Idempotent. Do not run arbitrary SQL through this module. */

export const OUTREACH_SCHEMA_SQL = `
ALTER TABLE public.outreach_settings
  ADD COLUMN IF NOT EXISTS opt_out_verified_at timestamptz;

ALTER TABLE public.outreach_settings
  ADD COLUMN IF NOT EXISTS settings_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.outreach_template_versions
  ADD COLUMN IF NOT EXISTS approved_settings_version integer;

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
`
