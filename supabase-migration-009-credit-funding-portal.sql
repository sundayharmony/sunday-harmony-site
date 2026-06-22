-- Credit & Funding portal enhancements: status workflow, business profile, messaging, history.
-- Run in Supabase SQL Editor after migration 008.

-- Migrate legacy status values
UPDATE credit_funding_applications SET status = 'declined' WHERE status = 'denied';

-- Expand application columns
ALTER TABLE credit_funding_applications
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_specialist TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS next_steps TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'credit_and_funding',
  ADD COLUMN IF NOT EXISTS business_profile JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS funding_scores JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_credit_funding_applications_user_id
  ON credit_funding_applications (user_id);

CREATE INDEX IF NOT EXISTS idx_credit_funding_applications_client_id
  ON credit_funding_applications (client_id);

CREATE INDEX IF NOT EXISTS idx_credit_funding_applications_assigned
  ON credit_funding_applications (assigned_specialist);

-- Replace status check constraint with expanded workflow
ALTER TABLE credit_funding_applications DROP CONSTRAINT IF EXISTS credit_funding_applications_status_check;

ALTER TABLE credit_funding_applications
  ADD CONSTRAINT credit_funding_applications_status_check
  CHECK (status IN (
    'submitted',
    'documents_pending',
    'under_review',
    'credit_analysis_complete',
    'funding_review',
    'additional_information_requested',
    'approved',
    'declined',
    'completed',
    'archived'
  ));

-- Expand document types for business uploads
ALTER TABLE uploaded_documents DROP CONSTRAINT IF EXISTS uploaded_documents_document_type_check;

ALTER TABLE uploaded_documents
  ADD CONSTRAINT uploaded_documents_document_type_check
  CHECK (document_type IN (
    'photo_id',
    'proof_of_address',
    'selfie_with_id',
    'mail_proof',
    'articles_of_organization',
    'ein_letter',
    'business_license',
    'bank_statements',
    'tax_returns',
    'profit_and_loss',
    'balance_sheet',
    'other_business'
  ));

-- Status change timeline
CREATE TABLE IF NOT EXISTS credit_funding_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_uuid UUID NOT NULL REFERENCES credit_funding_applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  staff_email TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cf_status_history_application
  ON credit_funding_status_history (application_uuid, created_at DESC);

-- Secure messaging between admin and applicant
CREATE TABLE IF NOT EXISTS credit_funding_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_uuid UUID NOT NULL REFERENCES credit_funding_applications(id) ON DELETE CASCADE,
  from_role TEXT NOT NULL CHECK (from_role IN ('admin', 'applicant')),
  from_name TEXT NOT NULL,
  from_email TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cf_messages_application
  ON credit_funding_messages (application_uuid, created_at ASC);

-- Document requests from staff to applicant
CREATE TABLE IF NOT EXISTS credit_funding_document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_uuid UUID NOT NULL REFERENCES credit_funding_applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  label TEXT NOT NULL,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploaded', 'waived')),
  requested_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cf_doc_requests_application
  ON credit_funding_document_requests (application_uuid, status);
