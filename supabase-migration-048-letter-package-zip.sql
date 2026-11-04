-- Migration 048: Persist prebuilt letter-package ZIP artifacts.
-- Run in Supabase SQL Editor after migration 039.
-- Generate builds the ZIP once; Download ZIP serves the stored blob (rebuild fallback if missing).

ALTER TABLE dispute_letter_packages
  ADD COLUMN IF NOT EXISTS zip_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS zip_built_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS zip_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS zip_letter_ids TEXT,
  ADD COLUMN IF NOT EXISTS zip_error TEXT,
  ADD COLUMN IF NOT EXISTS zip_byte_size INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dispute_letter_packages_zip_status_check'
  ) THEN
    ALTER TABLE dispute_letter_packages
      ADD CONSTRAINT dispute_letter_packages_zip_status_check
      CHECK (zip_status IN ('pending', 'building', 'ready', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_letter_packages_zip_status
  ON dispute_letter_packages (zip_status)
  WHERE zip_status IS NOT NULL;

COMMENT ON COLUMN dispute_letter_packages.zip_storage_path IS
  'Supabase Storage path for the prebuilt letters ZIP under dispute-letters bucket.';
COMMENT ON COLUMN dispute_letter_packages.zip_status IS
  'pending | building | ready | failed — Download ZIP prefers ready artifacts.';
COMMENT ON COLUMN dispute_letter_packages.zip_letter_ids IS
  'Sorted letter-id signature used to detect stale ZIP after regenerate.';
