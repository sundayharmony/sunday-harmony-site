-- Client case studies: one PDF per client for public marketing showcase.
-- Run in Supabase SQL Editor after prior migrations.
-- App code: src/lib/client-case-studies-storage.ts (bucket id must match).

CREATE TABLE IF NOT EXISTS client_case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  uploaded_by_name TEXT NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_case_studies_published
  ON client_case_studies (published)
  WHERE published = true;

CREATE INDEX IF NOT EXISTS idx_client_case_studies_client
  ON client_case_studies (client_id);

ALTER TABLE client_case_studies ENABLE ROW LEVEL SECURITY;

-- Public bucket for embedded PDF viewing on the marketing site.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-case-studies', 'client-case-studies', true, 10485760)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "client_case_studies_select_public" ON storage.objects;
CREATE POLICY "client_case_studies_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-case-studies');
