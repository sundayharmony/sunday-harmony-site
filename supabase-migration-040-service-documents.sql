-- Service Documents — Agreements and Proposals with e-signature support
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS service_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (document_type IN ('agreement', 'proposal')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'expired', 'cancelled')),
  document_number TEXT NOT NULL UNIQUE,
  
  -- Client info
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_address TEXT,
  
  -- Package selection
  package_tier TEXT NOT NULL,
  package_price NUMERIC NOT NULL,
  price_type TEXT NOT NULL CHECK (price_type IN ('one-time', 'monthly', 'custom')),
  custom_scope TEXT,
  
  -- Dates
  effective_date DATE,
  proposal_valid_until DATE,
  
  -- Proposal-specific fields (JSONB for flexibility)
  audit_date DATE,
  audit_findings JSONB,
  client_goals JSONB,
  timeline_phases JSONB,
  investment_items JSONB,
  
  -- Client signature
  client_signature TEXT,
  client_signature_type TEXT CHECK (client_signature_type IN ('typed', 'drawn')),
  client_signed_at TIMESTAMPTZ,
  client_signed_ip TEXT,
  
  -- Staff signature
  staff_signature TEXT,
  staff_signed_at TIMESTAMPTZ,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  
  -- Access token (hashed) for secure signing links
  access_token_hash TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_service_documents_client_email ON service_documents (LOWER(client_email));
CREATE INDEX IF NOT EXISTS idx_service_documents_status ON service_documents (status);
CREATE INDEX IF NOT EXISTS idx_service_documents_type ON service_documents (document_type);
CREATE INDEX IF NOT EXISTS idx_service_documents_created_by ON service_documents (created_by);
CREATE INDEX IF NOT EXISTS idx_service_documents_created_at ON service_documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_documents_access_token ON service_documents (access_token_hash) WHERE access_token_hash IS NOT NULL;

-- RLS policies
ALTER TABLE service_documents ENABLE ROW LEVEL SECURITY;

-- Staff can view and manage all documents
CREATE POLICY service_documents_staff_all ON service_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'credit_manager')
    )
  );

-- Clients can only view their own signed documents
CREATE POLICY service_documents_client_read ON service_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN clients c ON c.id = u.client_id
      WHERE u.id = auth.uid()
      AND u.role = 'client'
      AND LOWER(service_documents.client_email) = LOWER(c.email)
      AND service_documents.status IN ('sent', 'viewed', 'signed')
    )
  );

COMMENT ON TABLE service_documents IS 'Service agreements and proposals with e-signature support';
COMMENT ON COLUMN service_documents.access_token_hash IS 'Hashed token for secure document access links';
COMMENT ON COLUMN service_documents.client_signed_ip IS 'IP address recorded at time of client signature for audit trail';
