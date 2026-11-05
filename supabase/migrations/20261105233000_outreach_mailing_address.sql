-- Same SQL as supabase-migration-055-outreach-mailing-address.sql
-- Additive. Apply after 053 and 054. Does not activate send.

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
