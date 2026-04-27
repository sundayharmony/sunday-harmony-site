-- Add potential-client and billing tracking fields
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_potential BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'not_started'
    CHECK (billing_status IN ('not_started', 'trial', 'paid', 'past_due', 'unpaid')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clients_billing_status ON clients(billing_status);
