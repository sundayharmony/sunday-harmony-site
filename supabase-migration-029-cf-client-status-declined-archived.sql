-- Expand credit_funding_client_status vocabulary for declined/archived terminals.
-- Run in Supabase SQL Editor after migration 028.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_credit_funding_client_status_check;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_credit_funding_client_status_check;
ALTER TABLE credit_funding_applications DROP CONSTRAINT IF EXISTS credit_funding_applications_credit_funding_client_status_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_credit_funding_client_status_check
  CHECK (credit_funding_client_status IS NULL OR credit_funding_client_status IN (
    'intake_started', 'intake_completed', 'documents_pending', 'under_review', 'credit_analysis',
    'funding_analysis', 'recommendations_delivered', 'active_client', 'completed',
    'declined', 'archived'
  ));

ALTER TABLE clients
  ADD CONSTRAINT clients_credit_funding_client_status_check
  CHECK (credit_funding_client_status IS NULL OR credit_funding_client_status IN (
    'intake_started', 'intake_completed', 'documents_pending', 'under_review', 'credit_analysis',
    'funding_analysis', 'recommendations_delivered', 'active_client', 'completed',
    'declined', 'archived'
  ));

ALTER TABLE credit_funding_applications
  ADD CONSTRAINT credit_funding_applications_credit_funding_client_status_check
  CHECK (credit_funding_client_status IS NULL OR credit_funding_client_status IN (
    'intake_started', 'intake_completed', 'documents_pending', 'under_review', 'credit_analysis',
    'funding_analysis', 'recommendations_delivered', 'active_client', 'completed',
    'declined', 'archived'
  ));
