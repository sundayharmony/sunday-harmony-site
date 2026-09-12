-- Migration 035: Dispute ops Phases 2–5 — mail tracking, responses, CFPB escalations.
-- Run in Supabase SQL Editor after migration 034.

-- Round mail / deadline fields
ALTER TABLE dispute_rounds
  ADD COLUMN IF NOT EXISTS mail_method TEXT
    CHECK (mail_method IS NULL OR mail_method IN ('certified', 'priority', 'other'));

ALTER TABLE dispute_rounds
  ADD COLUMN IF NOT EXISTS tracking_number TEXT;

ALTER TABLE dispute_rounds
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE dispute_rounds
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;

ALTER TABLE dispute_rounds
  ADD COLUMN IF NOT EXISTS packet_checklist JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Response uploads (bureau/furnisher reply PDFs)
CREATE TABLE IF NOT EXISTS dispute_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES dispute_rounds(id) ON DELETE CASCADE,
  item_id UUID REFERENCES dispute_items(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'bureau'
    CHECK (source IN ('bureau', 'furnisher', 'collector', 'cfpb', 'other')),
  file_name TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL,
  notes TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_responses_round
  ON dispute_responses (round_id, created_at DESC);

-- CFPB escalation drafts / tracking (no auto-login)
CREATE TABLE IF NOT EXISTS dispute_cfpb_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES dispute_cases(id) ON DELETE CASCADE,
  item_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'agency_response', 'closed')),
  complaint_markdown TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ,
  agency_response_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_cfpb_case
  ON dispute_cfpb_escalations (case_id, created_at DESC);

-- Client portal release: staff can release a round packet to the client
ALTER TABLE dispute_rounds
  ADD COLUMN IF NOT EXISTS client_released_at TIMESTAMPTZ;

ALTER TABLE dispute_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_cfpb_escalations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE dispute_responses IS
  'Bureau/furnisher/collector reply documents tied to a dispute round.';
COMMENT ON TABLE dispute_cfpb_escalations IS
  'In-app CFPB complaint drafts and status; credentials stay on the funding application.';
