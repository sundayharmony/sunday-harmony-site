-- ══════════════════════════════════════════════════════════
-- Sunday Harmony — Supabase Database Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ══════════════════════════════════════════════════════════

-- ══════════ USERS TABLE ══════════
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
  client_id UUID,
  session_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════ LEADS TABLE ══════════
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT DEFAULT '',
  email TEXT,
  phone TEXT,
  business TEXT NOT NULL,
  industry TEXT,
  service TEXT,
  budget TEXT,
  message TEXT,
  source TEXT DEFAULT 'inbound' CHECK (source IN ('inbound', 'outbound')),
  website TEXT,
  google_place_id TEXT UNIQUE,
  location_text TEXT,
  discovered_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'audit_sent', 'proposal', 'won', 'lost')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════ CLIENTS TABLE ══════════
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  business TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  industry TEXT,
  package_tier TEXT NOT NULL CHECK (package_tier IN ('free', 'social_essentials', 'spark', 'growth', 'scale')),
  monthly_price NUMERIC DEFAULT 0,
  start_date TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'churned')),
  is_potential BOOLEAN DEFAULT FALSE,
  billing_status TEXT DEFAULT 'not_started' CHECK (billing_status IN ('not_started', 'trial', 'paid', 'past_due', 'unpaid')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  last_payment_at TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  deliverables JSONB DEFAULT '[]'::jsonb,
  quick_wins JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════ MESSAGES TABLE ══════════
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  from_role TEXT NOT NULL CHECK (from_role IN ('admin', 'client')),
  from_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════ ADMIN DATA TABLE ══════════
CREATE TABLE IF NOT EXISTS admin_data (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  roadmap_tasks JSONB DEFAULT '{}'::jsonb,
  positioning_canvas JSONB DEFAULT '{}'::jsonb,
  research_tasks JSONB DEFAULT '{}'::jsonb,
  weekly_activity JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert singleton admin data row
INSERT INTO admin_data (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;

-- ══════════ ROW LEVEL SECURITY ══════════
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_data ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (our API routes use service role key)
CREATE POLICY "Service role full access" ON users FOR ALL USING (true);
CREATE POLICY "Service role full access" ON leads FOR ALL USING (true);
CREATE POLICY "Service role full access" ON clients FOR ALL USING (true);
CREATE POLICY "Service role full access" ON messages FOR ALL USING (true);
CREATE POLICY "Service role full access" ON admin_data FOR ALL USING (true);

-- ══════════ INDEXES ══════════
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_place_id ON leads(google_place_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_billing_status ON clients(billing_status);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- ══════════ AUTO-UPDATE TIMESTAMPS ══════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER admin_data_updated_at BEFORE UPDATE ON admin_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════ STRIPE WEBHOOK IDEMPOTENCY ══════════
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON stripe_webhook_events FOR ALL USING (true);
