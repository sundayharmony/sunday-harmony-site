-- Migration 042: public consultation booking (hours, blackouts, bookings).
-- Run in the Supabase SQL Editor. Service-role Next.js APIs only: RLS on, no policies.

CREATE TABLE IF NOT EXISTS consultation_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  slot_minutes INT NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 15 AND 180),
  buffer_minutes INT NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 120),
  window_days INT NOT NULL DEFAULT 14 CHECK (window_days BETWEEN 1 AND 60),
  min_lead_minutes INT NOT NULL DEFAULT 120 CHECK (min_lead_minutes BETWEEN 0 AND 10080),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO consultation_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS consultation_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute INT NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute INT NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  CHECK (end_minute > start_minute)
);

CREATE INDEX IF NOT EXISTS idx_consultation_hours_weekday
  ON consultation_hours (weekday, start_minute);

CREATE TABLE IF NOT EXISTS consultation_blackouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blackout_date DATE NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS consultation_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL DEFAULT '',
  business TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  meet_link TEXT,
  calendar_event_id TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  meeting_id UUID REFERENCES client_meetings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  cancel_token TEXT NOT NULL UNIQUE,
  confirmation_sent_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS consultation_bookings_one_open_slot
  ON consultation_bookings (starts_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_consultation_bookings_status_start
  ON consultation_bookings (status, starts_at);

ALTER TABLE consultation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_blackouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_bookings ENABLE ROW LEVEL SECURITY;
