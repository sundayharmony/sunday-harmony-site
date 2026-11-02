-- Marketing CRM: pipeline stages, prospect fields, role handoffs, Google ids.
-- Run in the Supabase SQL Editor. Service-role Next.js APIs only.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'admin', 'client', 'credit_manager', 'partner',
    'lead_procurement', 'sales_closer', 'client_relations'
  ));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source IS NULL OR source IN (
    'inbound', 'outbound', 'website', 'in_person', 'linkedin', 'referral', 'partner', 'other'
  ));

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS prospect_category TEXT,
  ADD COLUMN IF NOT EXISTS marketing_opportunity TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recommended_service TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prospect_score SMALLINT,
  ADD COLUMN IF NOT EXISTS score_factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC,
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT,
  ADD COLUMN IF NOT EXISTS assigned_role TEXT,
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID,
  ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_event_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_url TEXT,
  ADD COLUMN IF NOT EXISTS proposal_doc_id TEXT,
  ADD COLUMN IF NOT EXISTS proposal_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS google_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS agreement_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS services_purchased TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS scope_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deliverables_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deadline_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS promises TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS expectations TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS handed_to_sales_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handed_to_relations_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_prospect_category_check;
ALTER TABLE leads ADD CONSTRAINT leads_prospect_category_check
  CHECK (prospect_category IS NULL OR prospect_category IN ('established', 'small', 'startup'));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_prospect_score_check;
ALTER TABLE leads ADD CONSTRAINT leads_prospect_score_check
  CHECK (prospect_score IS NULL OR (prospect_score >= 0 AND prospect_score <= 10));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_pipeline_stage_check;
ALTER TABLE leads ADD CONSTRAINT leads_pipeline_stage_check
  CHECK (pipeline_stage IS NULL OR pipeline_stage IN (
    'researching', 'ready_to_contact', 'contacted', 'responded', 'meeting_scheduled',
    'proposal_sent', 'negotiation', 'won', 'lost_nurture'
  ));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_assigned_role_check;
ALTER TABLE leads ADD CONSTRAINT leads_assigned_role_check
  CHECK (assigned_role IS NULL OR assigned_role IN ('lead_procurement', 'sales_closer', 'client_relations'));

UPDATE leads
SET pipeline_stage = CASE
  WHEN marketing_lead_status = 'converted' OR status = 'won' THEN 'won'
  WHEN marketing_lead_status = 'not_interested' OR status = 'lost' THEN 'lost_nurture'
  WHEN status = 'proposal' THEN 'proposal_sent'
  WHEN marketing_lead_status = 'consultation_scheduled' THEN 'meeting_scheduled'
  WHEN marketing_lead_status = 'qualified' THEN 'ready_to_contact'
  WHEN marketing_lead_status = 'contacted' OR status = 'contacted' THEN 'contacted'
  WHEN source IN ('inbound', 'website') THEN 'responded'
  ELSE 'researching'
END
WHERE pipeline_stage IS NULL
  AND (lead_type IS NULL OR lead_type = 'marketing_lead' OR marketing_lead_status IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads (pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads (follow_up_at);

CREATE TABLE IF NOT EXISTS marketing_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_role TEXT NOT NULL,
  to_role TEXT NOT NULL,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_handoffs_lead
  ON marketing_handoffs (lead_id, created_at DESC);

ALTER TABLE marketing_handoffs ENABLE ROW LEVEL SECURITY;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS onboarding JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_url TEXT,
  ADD COLUMN IF NOT EXISTS relations_notes TEXT NOT NULL DEFAULT '';
