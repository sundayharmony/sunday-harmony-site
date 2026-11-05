-- Migration 054 / additive follow-up to 053 (20261105203827_prospect_outreach).
-- PREPARE ONLY. Do not apply from this change. The operator applies SQL.
--
-- User-run order:
--   1. If 053 is not applied, apply supabase-migration-053-prospect-outreach.sql first.
--   2. Apply this file (054). It only adds columns; it does not rewrite 053 data.
--   3. If 053 was already applied, skip 053 and run 054 only.
-- Do not drop tables, do not rewind 053, and do not treat Email Bot reports as provider history.
--
-- After 054, opt-out verification and settings-version invalidation can persist.
-- Activation and live send remain blocked until every server-side gate is satisfied.

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
