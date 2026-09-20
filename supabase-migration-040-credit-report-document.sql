-- Allow 3-bureau credit report uploads on Credit & Funding intake.
-- Run in Supabase SQL Editor after migration 012.

ALTER TABLE uploaded_documents DROP CONSTRAINT IF EXISTS uploaded_documents_document_type_check;

ALTER TABLE uploaded_documents
  ADD CONSTRAINT uploaded_documents_document_type_check
  CHECK (document_type IN (
    'photo_id',
    'proof_of_address',
    'selfie_with_id',
    'mail_proof',
    'credit_report',
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
