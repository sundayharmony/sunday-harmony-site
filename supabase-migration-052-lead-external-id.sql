-- Stable spreadsheet Lead ID (SH-0001, …) for marketing CRM bulk import.
-- Run by hand in the Supabase SQL Editor. Not applied by the Next.js app.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS external_lead_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_external_lead_id
  ON leads (external_lead_id);

COMMENT ON COLUMN leads.external_lead_id IS
  'Permanent Google Sheet Lead ID (for example SH-0001). Unique when set; NULLs are allowed.';
