-- Migration 041: partner accounts for referral links (mortgage, auto, real estate).
-- Run in the Supabase SQL Editor. Partners are not clients and not staff.
-- Service-role Next.js APIs only: RLS on, no permissive policies.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'client', 'credit_manager', 'partner'));

CREATE TABLE IF NOT EXISTS partner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  company_name TEXT NOT NULL,
  service_area TEXT NOT NULL,
  years_in_field INTEGER NOT NULL CHECK (years_in_field >= 0 AND years_in_field <= 80),
  profession TEXT NOT NULL CHECK (profession IN ('mortgage', 'auto_sales', 'real_estate', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_profiles_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_profiles_status
  ON partner_profiles (status, created_at DESC);

ALTER TABLE partner_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE referral_profiles ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE referral_profiles
  ADD COLUMN IF NOT EXISTS partner_profile_id UUID REFERENCES partner_profiles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS referral_profiles_partner_unique
  ON referral_profiles (partner_profile_id)
  WHERE partner_profile_id IS NOT NULL;

ALTER TABLE referral_profiles DROP CONSTRAINT IF EXISTS referral_profiles_owner_check;
ALTER TABLE referral_profiles ADD CONSTRAINT referral_profiles_owner_check
  CHECK (
    (client_id IS NOT NULL AND partner_profile_id IS NULL)
    OR (client_id IS NULL AND partner_profile_id IS NOT NULL)
  );

COMMENT ON TABLE partner_profiles IS
  'External referral partners. Not clients. Referral link stays inactive until an admin approves the profile.';
