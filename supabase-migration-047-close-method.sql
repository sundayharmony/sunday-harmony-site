-- Close method: track how deals were closed (standard, verbal, email-only, etc.)
-- Run in the Supabase SQL Editor. Service-role Next.js APIs only.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS close_method TEXT;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_close_method_check;
ALTER TABLE leads ADD CONSTRAINT leads_close_method_check
  CHECK (close_method IS NULL OR close_method IN (
    'standard',
    'verbal',
    'email_only',
    'referral_fast',
    'reactivated',
    'other'
  ));

COMMENT ON COLUMN leads.close_method IS 'How the deal was closed: standard (meeting+proposal), verbal (no formal proposal), email_only, referral_fast, reactivated, or other';
