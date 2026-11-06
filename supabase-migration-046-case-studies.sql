-- Migration 046: case studies for the About page.
-- Run in the Supabase SQL Editor after migration 045.
-- These are marketing notes written by an admin, not partner login accounts.
-- Logos stay in the existing public partner-logos bucket.

CREATE TABLE IF NOT EXISTS case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  blurb TEXT NOT NULL DEFAULT '',
  logo_path TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_studies_published
  ON case_studies (published, company_name);

ALTER TABLE case_studies ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE case_studies IS
  'Public About page case studies. Admins write the company name and note. Not partner logins.';

INSERT INTO case_studies (company_name, blurb, logo_path, published)
SELECT p.company_name, '', p.logo_path, true
FROM partner_profiles p
WHERE p.status = 'active'
  AND p.logo_path IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM case_studies c WHERE c.logo_path = p.logo_path
  );
