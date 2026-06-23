-- Staff-shared documents linked to workflow step updates.
-- Run in Supabase SQL Editor after migration 011.

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
    'other_business',
    'staff_shared'
  ));

ALTER TABLE uploaded_documents
  ADD COLUMN IF NOT EXISTS shared_by TEXT
    CHECK (shared_by IS NULL OR shared_by IN ('applicant', 'admin')),
  ADD COLUMN IF NOT EXISTS status_history_id UUID
    REFERENCES credit_funding_status_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_id UUID
    REFERENCES credit_funding_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_uploaded_documents_status_history
  ON uploaded_documents (status_history_id)
  WHERE status_history_id IS NOT NULL;
