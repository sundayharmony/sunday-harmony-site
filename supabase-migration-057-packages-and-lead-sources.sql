-- Business Launch is a real client plan. Custom Solutions has no placeholder price.
-- Ads is a lead source. Run in the Supabase SQL Editor after 056.

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_package_tier_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_package_tier_check
  CHECK (package_tier IN ('free', 'social_essentials', 'spark', 'business_launch', 'growth', 'scale'));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source IS NULL OR source IN (
    'inbound', 'outbound', 'website', 'ads', 'in_person', 'linkedin', 'referral', 'partner', 'other'
  ));
