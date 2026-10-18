-- Optional "Referred by" name on credit intake applications.
-- Run in the Supabase SQL Editor. Safe to run more than once.

ALTER TABLE credit_funding_applications
  ADD COLUMN IF NOT EXISTS referred_by TEXT;
