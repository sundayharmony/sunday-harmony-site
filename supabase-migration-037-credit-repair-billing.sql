-- Migration 037: One-time credit repair billing, separate from marketing subscriptions.
-- Run in Supabase SQL Editor after migration 036.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS billing_model TEXT NOT NULL DEFAULT 'marketing_subscription';

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS repair_fee_cents INTEGER;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS repair_fee_paid_at TIMESTAMPTZ;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS stripe_repair_invoice_id TEXT;

DO $$
BEGIN
  ALTER TABLE clients
    ADD CONSTRAINT clients_billing_model_check
    CHECK (billing_model IN ('marketing_subscription', 'credit_repair_one_time'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE clients
SET billing_model = 'credit_repair_one_time'
WHERE billing_model = 'marketing_subscription'
  AND COALESCE(lead_type, '') IN ('credit_repair_lead', 'credit_repair_funding');

COMMENT ON COLUMN clients.billing_model IS
  'marketing_subscription = monthly marketing packages; credit_repair_one_time = one-time repair fee.';
COMMENT ON COLUMN clients.repair_fee_cents IS
  'Last quoted or collected credit repair fee in USD cents.';
COMMENT ON COLUMN clients.repair_fee_paid_at IS
  'When the one-time credit repair invoice was paid.';
COMMENT ON COLUMN clients.stripe_repair_invoice_id IS
  'Stripe invoice id for the latest credit repair fee.';
