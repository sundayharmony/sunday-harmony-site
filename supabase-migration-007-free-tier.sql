-- Add free tier for internal/testing clients (no Stripe subscription)
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_package_tier_check;

ALTER TABLE clients
  ADD CONSTRAINT clients_package_tier_check
  CHECK (package_tier IN ('free', 'social_essentials', 'spark', 'growth', 'scale'));
