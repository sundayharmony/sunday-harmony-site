-- Migration 045: partner logos for the About page slideshow.
-- Run in the Supabase SQL Editor after migration 041.
-- Service-role Next.js APIs upload the file. The bucket is public so the
-- marketing page can show a stable logo URL.

ALTER TABLE partner_profiles
  ADD COLUMN IF NOT EXISTS logo_path TEXT;

COMMENT ON COLUMN partner_profiles.logo_path IS
  'Object path in the partner-logos bucket. Empty until an admin uploads a logo from the partner profile.';

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('partner-logos', 'partner-logos', true, 2097152)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "partner_logos_select_public" ON storage.objects;
CREATE POLICY "partner_logos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'partner-logos');
