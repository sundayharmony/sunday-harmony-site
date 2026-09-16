-- Migration 039: Letter packages — generated letters grouped for a dispute round.
-- Run in Supabase SQL Editor after migration 036.
-- A package is the ZIP unit: generate → download → confirm sent. Download is not Sent.

CREATE TABLE IF NOT EXISTS dispute_letter_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES dispute_cases(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES dispute_rounds(id) ON DELETE CASCADE,
  session_id UUID REFERENCES dispute_sessions(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_active BOOLEAN NOT NULL DEFAULT true,
  letter_count INTEGER NOT NULL DEFAULT 0 CHECK (letter_count >= 0),
  downloaded_at TIMESTAMPTZ,
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  sent_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_letter_packages_one_active
  ON dispute_letter_packages (round_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_letter_packages_case
  ON dispute_letter_packages (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_letter_packages_session
  ON dispute_letter_packages (session_id)
  WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS dispute_letter_package_items (
  package_id UUID NOT NULL REFERENCES dispute_letter_packages(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES dispute_items(id) ON DELETE CASCADE,
  letter_id UUID REFERENCES dispute_letters(id) ON DELETE SET NULL,
  letter_type TEXT NOT NULL DEFAULT 'bureau',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (package_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_letter_package_items_letter
  ON dispute_letter_package_items (letter_id)
  WHERE letter_id IS NOT NULL;

ALTER TABLE dispute_letters
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES dispute_letter_packages(id) ON DELETE SET NULL;

ALTER TABLE dispute_letters
  ADD COLUMN IF NOT EXISTS letter_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE dispute_rounds
  ADD COLUMN IF NOT EXISTS active_package_id UUID REFERENCES dispute_letter_packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dispute_letters_package
  ON dispute_letters (package_id)
  WHERE package_id IS NOT NULL;

ALTER TABLE dispute_letter_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_letter_package_items ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE dispute_letter_packages IS
  'Group of letters generated together for one dispute round. Re-download is the same package; regenerate creates a new version.';
COMMENT ON COLUMN dispute_letter_packages.downloaded_at IS
  'First ZIP download. Does not mean the letters were mailed.';
COMMENT ON COLUMN dispute_letter_packages.sent_confirmed_at IS
  'Staff confirmed every letter in this package was mailed.';
COMMENT ON TABLE dispute_letter_package_items IS
  'Credit items included in a letter package. Confirm-sent updates only these rows.';
