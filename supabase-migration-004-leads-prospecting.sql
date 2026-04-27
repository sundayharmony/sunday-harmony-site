-- Expand leads for outbound prospecting and discovery metadata
ALTER TABLE leads
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'inbound'
    CHECK (source IN ('inbound', 'outbound')),
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS location_text TEXT,
  ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

UPDATE leads
SET source = 'inbound'
WHERE source IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_google_place_id_unique
  ON leads(google_place_id)
  WHERE google_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
