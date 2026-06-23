-- Experian.com credentials for credit monitoring intake (Step 4).
-- Run in Supabase SQL Editor after prior migrations.

ALTER TABLE credit_funding_applications
  ADD COLUMN IF NOT EXISTS experian_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS experian_password_encrypted TEXT;
