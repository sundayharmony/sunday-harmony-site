-- Same SQL as supabase-migration-054-outreach-activation-wiring.sql
-- Additive only. Safe if 053 / 20261105203827_prospect_outreach is already applied.

ALTER TABLE public.outreach_settings
  ADD COLUMN IF NOT EXISTS opt_out_verified_at timestamptz;

ALTER TABLE public.outreach_settings
  ADD COLUMN IF NOT EXISTS settings_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.outreach_template_versions
  ADD COLUMN IF NOT EXISTS approved_settings_version integer;

COMMENT ON COLUMN public.outreach_settings.opt_out_verified_at IS
  'Set only after a server-side unsubscribe token persist + confirm + suppression roundtrip.';
COMMENT ON COLUMN public.outreach_settings.settings_version IS
  'Incremented on operator settings changes; template approval is bound to this version.';
COMMENT ON COLUMN public.outreach_template_versions.approved_settings_version IS
  'Settings version at approval time. Mismatch invalidates send/activation until re-approval.';
