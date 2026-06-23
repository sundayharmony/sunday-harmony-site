-- Encrypted Social Security Number for credit & funding applications.
-- Run in Supabase SQL Editor after migration 013.

ALTER TABLE credit_funding_applications
  ADD COLUMN IF NOT EXISTS ssn_encrypted TEXT;
