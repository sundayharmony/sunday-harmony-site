-- Prevent ambiguous Stripe billing ownership. Empty strings are legacy "unset" values.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_stripe_customer_id_unique
  ON clients (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_stripe_subscription_id_unique
  ON clients (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id <> '';
