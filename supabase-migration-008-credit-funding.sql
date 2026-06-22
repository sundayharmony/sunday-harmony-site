-- Credit & Funding intake applications and secure document storage.
-- Run in Supabase SQL Editor after prior migrations.

CREATE TABLE IF NOT EXISTS credit_funding_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth_encrypted TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  credit_profile JSONB NOT NULL DEFAULT '{}',
  selected_credit_provider TEXT NOT NULL,
  provider_username_encrypted TEXT,
  provider_password_encrypted TEXT,
  credit_goals JSONB NOT NULL DEFAULT '[]',
  funding_goals TEXT NOT NULL DEFAULT '',
  primary_credit_goals_text TEXT DEFAULT '',
  funding_amount TEXT,
  funding_use TEXT,
  owns_business BOOLEAN,
  business_name TEXT,
  funding_timeframe TEXT,
  goals_notes TEXT,
  consent_data JSONB NOT NULL DEFAULT '{}',
  typed_signature TEXT NOT NULL,
  signature_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'approved', 'denied', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_funding_applications_status
  ON credit_funding_applications (status);

CREATE INDEX IF NOT EXISTS idx_credit_funding_applications_email
  ON credit_funding_applications (email);

CREATE INDEX IF NOT EXISTS idx_credit_funding_applications_created_at
  ON credit_funding_applications (created_at DESC);

CREATE TABLE IF NOT EXISTS uploaded_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_uuid UUID NOT NULL REFERENCES credit_funding_applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('photo_id', 'proof_of_address', 'selfie_with_id', 'mail_proof')),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  scan_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending', 'clean', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_documents_application
  ON uploaded_documents (application_uuid);

-- Private bucket for sensitive identity documents (signed URLs only).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('credit-funding-docs', 'credit-funding-docs', false, 20971520)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;
