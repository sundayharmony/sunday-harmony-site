-- CRM enhancements: lead type segmentation, workflows, meetings, contact linking.
-- Run in Supabase SQL Editor after migration 009.

-- ─── Lead types (shared enum) ───
-- marketing_lead | credit_repair_lead | personal_funding_lead | business_funding_lead
-- credit_repair_funding | existing_client | completed_client

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lead_type TEXT NOT NULL DEFAULT 'marketing_lead'
    CHECK (lead_type IN (
      'marketing_lead', 'credit_repair_lead', 'personal_funding_lead', 'business_funding_lead',
      'credit_repair_funding', 'existing_client', 'completed_client'
    )),
  ADD COLUMN IF NOT EXISTS marketing_lead_status TEXT DEFAULT 'new_lead'
    CHECK (marketing_lead_status IS NULL OR marketing_lead_status IN (
      'new_lead', 'contacted', 'consultation_scheduled', 'qualified', 'converted', 'not_interested'
    )),
  ADD COLUMN IF NOT EXISTS credit_funding_client_status TEXT
    CHECK (credit_funding_client_status IS NULL OR credit_funding_client_status IN (
      'intake_started', 'intake_completed', 'documents_pending', 'under_review', 'credit_analysis',
      'funding_analysis', 'recommendations_delivered', 'active_client', 'completed'
    )),
  ADD COLUMN IF NOT EXISTS assigned_team_member TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

UPDATE leads SET lead_type = 'marketing_lead' WHERE lead_type IS NULL;
UPDATE leads SET marketing_lead_status = 'new_lead'
  WHERE marketing_lead_status IS NULL AND lead_type = 'marketing_lead';
UPDATE leads SET marketing_lead_status = 'contacted'
  WHERE status = 'contacted' AND marketing_lead_status = 'new_lead';
UPDATE leads SET marketing_lead_status = 'converted'
  WHERE status = 'won' AND marketing_lead_status NOT IN ('converted');

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS lead_type TEXT
    CHECK (lead_type IS NULL OR lead_type IN (
      'marketing_lead', 'credit_repair_lead', 'personal_funding_lead', 'business_funding_lead',
      'credit_repair_funding', 'existing_client', 'completed_client'
    )),
  ADD COLUMN IF NOT EXISTS marketing_lead_status TEXT
    CHECK (marketing_lead_status IS NULL OR marketing_lead_status IN (
      'new_lead', 'contacted', 'consultation_scheduled', 'qualified', 'converted', 'not_interested'
    )),
  ADD COLUMN IF NOT EXISTS credit_funding_client_status TEXT
    CHECK (credit_funding_client_status IS NULL OR credit_funding_client_status IN (
      'intake_started', 'intake_completed', 'documents_pending', 'under_review', 'credit_analysis',
      'funding_analysis', 'recommendations_delivered', 'active_client', 'completed'
    )),
  ADD COLUMN IF NOT EXISTS assigned_team_member TEXT,
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE credit_funding_applications
  ADD COLUMN IF NOT EXISTS lead_type TEXT
    CHECK (lead_type IS NULL OR lead_type IN (
      'marketing_lead', 'credit_repair_lead', 'personal_funding_lead', 'business_funding_lead',
      'credit_repair_funding', 'existing_client', 'completed_client'
    )),
  ADD COLUMN IF NOT EXISTS credit_funding_client_status TEXT DEFAULT 'intake_completed'
    CHECK (credit_funding_client_status IS NULL OR credit_funding_client_status IN (
      'intake_started', 'intake_completed', 'documents_pending', 'under_review', 'credit_analysis',
      'funding_analysis', 'recommendations_delivered', 'active_client', 'completed'
    )),
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads(lead_type);
CREATE INDEX IF NOT EXISTS idx_leads_marketing_status ON leads(marketing_lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_cf_status ON leads(credit_funding_client_status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_team_member);
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_lead_type ON clients(lead_type);
CREATE INDEX IF NOT EXISTS idx_clients_lead_id ON clients(lead_id);
CREATE INDEX IF NOT EXISTS idx_cf_apps_lead_type ON credit_funding_applications(lead_type);
CREATE INDEX IF NOT EXISTS idx_cf_apps_lead_id ON credit_funding_applications(lead_id);

-- ─── Client meetings ───
CREATE TABLE IF NOT EXISTS client_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  application_uuid UUID REFERENCES credit_funding_applications(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  meeting_type TEXT NOT NULL DEFAULT 'consultation'
    CHECK (meeting_type IN ('consultation', 'funding_review', 'credit_strategy', 'follow_up')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  notes TEXT DEFAULT '',
  assigned_staff TEXT,
  google_meet_link TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_meetings_contact_check CHECK (client_id IS NOT NULL OR lead_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_client_meetings_client ON client_meetings(client_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_meetings_lead ON client_meetings(lead_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_meetings_scheduled ON client_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_client_meetings_status ON client_meetings(status);

ALTER TABLE client_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access meetings" ON client_meetings FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity_created
  ON activity_log(entity_type, entity_id, created_at DESC);
