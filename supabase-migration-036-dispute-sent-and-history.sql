-- Migration 036: Per-letter Sent tracking and item status history.
-- Run in Supabase SQL Editor after migration 035.
-- "Sent" is the official disputed action. Generating letters must not stamp items disputed.

ALTER TABLE dispute_letters
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE dispute_items
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE dispute_items
  ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE dispute_round_items
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE dispute_round_items
  ADD COLUMN IF NOT EXISTS letter_id UUID;

COMMENT ON COLUMN dispute_letters.sent_at IS
  'Staff confirmed this letter was mailed. That is when linked items become officially disputed.';
COMMENT ON COLUMN dispute_items.sent_at IS
  'When this tradeline was confirmed sent in its latest round.';
COMMENT ON COLUMN dispute_items.status_history IS
  'Ordered workflow events: identified, selected, letter_generated, sent, outcomes.';
