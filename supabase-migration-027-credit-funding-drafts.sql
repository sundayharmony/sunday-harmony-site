-- Staff-managed draft applications for Credit & Funding intake.
-- Run in Supabase SQL Editor after migration 026.

ALTER TABLE credit_funding_applications DROP CONSTRAINT IF EXISTS credit_funding_applications_status_check;

ALTER TABLE credit_funding_applications
  ADD CONSTRAINT credit_funding_applications_status_check
  CHECK (status IN (
    'draft',
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
  ADD COLUMN IF NOT EXISTS created_by_staff_email TEXT,
  ADD COLUMN IF NOT EXISTS draft_source TEXT;

CREATE INDEX IF NOT EXISTS idx_cf_apps_draft_email
  ON credit_funding_applications (email, status)
  WHERE status = 'draft';

COMMENT ON COLUMN credit_funding_applications.created_by_staff_email IS 'Staff email that created a manual draft application';
COMMENT ON COLUMN credit_funding_applications.draft_source IS 'Origin marker for staff drafts (e.g. staff_manual)';
