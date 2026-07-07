-- Migration 022: Admin dispute letter sessions, plans, letters, and private storage.
-- Run in Supabase SQL Editor after migration 021.
-- IMPORTANT: Use the Sunday Harmony production project (ref: hvsoeezsbvwsrdobvgaz).
-- App code: src/lib/dispute-letters-storage.ts (bucket id must match).

CREATE TABLE IF NOT EXISTS dispute_sessions (
  id UUID PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'analyzing', 'ready', 'failed')),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT '',
  report_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_sessions_admin_created
  ON dispute_sessions (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispute_sessions_status
  ON dispute_sessions (status);

CREATE TABLE IF NOT EXISTS dispute_letter_plans (
  session_id UUID PRIMARY KEY REFERENCES dispute_sessions(id) ON DELETE CASCADE,
  plans_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispute_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES dispute_sessions(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  title TEXT NOT NULL,
  markdown TEXT NOT NULL,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_letters_session
  ON dispute_letters (session_id);

ALTER TABLE dispute_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_letter_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_letters ENABLE ROW LEVEL SECURITY;

-- Service role (Next.js + Python API) bypasses RLS; no public policies.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('dispute-letters', 'dispute-letters', false, 52428800)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;
