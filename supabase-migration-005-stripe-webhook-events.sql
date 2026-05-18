-- Idempotent Stripe webhook processing: skip duplicate event deliveries by event id.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON stripe_webhook_events FOR ALL USING (true);
