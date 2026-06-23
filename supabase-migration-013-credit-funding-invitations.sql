-- Admin-initiated credit & funding application invitations.
-- Run in Supabase SQL Editor after migration 012.

ALTER TABLE credit_funding_applications DROP CONSTRAINT IF EXISTS credit_funding_applications_status_check;

ALTER TABLE credit_funding_applications
  ADD CONSTRAINT credit_funding_applications_status_check
  CHECK (status IN (
    'invitation_pending',
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

ALTER TABLE credit_funding_applications
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_personal_message TEXT;

CREATE INDEX IF NOT EXISTS idx_cf_apps_invitation_pending
  ON credit_funding_applications (email, status)
  WHERE status = 'invitation_pending';
