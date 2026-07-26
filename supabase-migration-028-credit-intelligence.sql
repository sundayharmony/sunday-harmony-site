-- Migration 028: Credit Intelligence Engine — link dispute sessions to funding apps.
-- Run in Supabase SQL Editor after migration 027.
-- IMPORTANT: Use the Sunday Harmony production project (ref: hvsoeezsbvwsrdobvgaz).

ALTER TABLE dispute_sessions
  ADD COLUMN IF NOT EXISTS application_uuid UUID
    REFERENCES credit_funding_applications(id) ON DELETE SET NULL;

ALTER TABLE dispute_sessions
  ADD COLUMN IF NOT EXISTS intelligence_json JSONB;

CREATE INDEX IF NOT EXISTS idx_dispute_sessions_application
  ON dispute_sessions (application_uuid, created_at DESC)
  WHERE application_uuid IS NOT NULL;

COMMENT ON COLUMN dispute_sessions.application_uuid IS
  'Optional link to credit_funding_applications for unified Credit Intelligence review.';
COMMENT ON COLUMN dispute_sessions.intelligence_json IS
  'Cached CreditIntelligenceReport snapshot (also embedded in report_json.credit_intelligence).';
