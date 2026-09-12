-- Migration 030: Dispute case / round / item lifecycle (Phase 1).
-- Run in Supabase SQL Editor after migration 029.
-- Enables Round N tracking and durable per-tradeline dispute status across report uploads.

CREATE TABLE IF NOT EXISTS dispute_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_uuid UUID REFERENCES credit_funding_applications(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active case per funding application when linked.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispute_cases_application_unique
  ON dispute_cases (application_uuid)
  WHERE application_uuid IS NOT NULL;

CREATE TABLE IF NOT EXISTS dispute_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES dispute_cases(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'letters_ready', 'mailed', 'awaiting_response', 'closed')),
  session_id UUID REFERENCES dispute_sessions(id) ON DELETE SET NULL,
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_dispute_rounds_case
  ON dispute_rounds (case_id, round_number DESC);

CREATE TABLE IF NOT EXISTS dispute_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES dispute_cases(id) ON DELETE CASCADE,
  match_key TEXT NOT NULL,
  creditor_name TEXT NOT NULL DEFAULT '',
  account_last4 TEXT NOT NULL DEFAULT '',
  bureau TEXT NOT NULL
    CHECK (bureau IN ('TUC', 'EXP', 'EQF')),
  account_type TEXT NOT NULL DEFAULT '',
  current_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (current_status IN (
      'pending',
      'selected_for_round',
      'disputed',
      'deleted',
      'verified',
      'updated',
      'no_response',
      'frivolous',
      'withdrawn'
    )),
  last_round_number INTEGER,
  last_letter_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, match_key)
);

CREATE INDEX IF NOT EXISTS idx_dispute_items_case_status
  ON dispute_items (case_id, current_status);

CREATE TABLE IF NOT EXISTS dispute_round_items (
  round_id UUID NOT NULL REFERENCES dispute_rounds(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES dispute_items(id) ON DELETE CASCADE,
  dispute_reason TEXT NOT NULL DEFAULT '',
  letter_type TEXT NOT NULL DEFAULT 'bureau',
  outcome TEXT
    CHECK (outcome IS NULL OR outcome IN (
      'deleted',
      'verified',
      'updated',
      'no_response',
      'frivolous',
      'withdrawn'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (round_id, item_id)
);

ALTER TABLE dispute_sessions
  ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES dispute_rounds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dispute_sessions_round
  ON dispute_sessions (round_id)
  WHERE round_id IS NOT NULL;

ALTER TABLE dispute_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_round_items ENABLE ROW LEVEL SECURITY;

-- Service role (Next.js + Python API) bypasses RLS; no public policies.
