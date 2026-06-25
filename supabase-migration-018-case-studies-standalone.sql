-- Case studies: standalone PDF uploads (no client link).
-- Run in Supabase SQL Editor after migration 016.

ALTER TABLE client_case_studies DROP CONSTRAINT IF EXISTS client_case_studies_client_id_fkey;
ALTER TABLE client_case_studies DROP CONSTRAINT IF EXISTS client_case_studies_client_id_key;
DROP INDEX IF EXISTS idx_client_case_studies_client;
ALTER TABLE client_case_studies DROP COLUMN IF EXISTS client_id;
