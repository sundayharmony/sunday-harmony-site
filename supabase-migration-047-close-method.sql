-- Close method: track deals that skipped the standard proposal flow.
-- Run in the Supabase SQL Editor. Service-role Next.js APIs only.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS close_method TEXT;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_close_method_check;
ALTER TABLE leads ADD CONSTRAINT leads_close_method_check
  CHECK (close_method IS NULL OR close_method = 'nonstandard');

COMMENT ON COLUMN leads.close_method IS 'Set to nonstandard when deal closed without a formal proposal';
