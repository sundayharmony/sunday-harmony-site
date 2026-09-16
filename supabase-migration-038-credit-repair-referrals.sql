-- Credit repair client referrals, commissions, and payouts.
-- Service-role Next.js APIs only: RLS on, no permissive policies.

CREATE TABLE IF NOT EXISTS referral_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  stripe_connect_account_id TEXT,
  payout_ready BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_profiles_client_id_unique UNIQUE (client_id),
  CONSTRAINT referral_profiles_code_unique UNIQUE (referral_code)
);

CREATE TABLE IF NOT EXISTS referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_profile_id UUID NOT NULL REFERENCES referral_profiles(id) ON DELETE CASCADE,
  attribution_id TEXT NOT NULL,
  landing_path TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_profile_created
  ON referral_clicks (referral_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_profile_id UUID NOT NULL REFERENCES referral_profiles(id) ON DELETE CASCADE,
  referred_application_id UUID REFERENCES credit_funding_applications(id) ON DELETE SET NULL,
  referred_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  referral_status TEXT NOT NULL DEFAULT 'attributed'
    CHECK (referral_status IN (
      'attributed',
      'submitted',
      'accepted',
      'paid',
      'cancelled'
    )),
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  application_submitted_at TIMESTAMPTZ,
  qualifying_payment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referrals_application_unique UNIQUE (referred_application_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_profile ON referrals (referral_profile_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_client ON referrals (referred_client_id);

CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID REFERENCES referrals(id) ON DELETE CASCADE,
  referral_profile_id UUID NOT NULL REFERENCES referral_profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_referral
  ON referral_events (referral_id, created_at);

CREATE TABLE IF NOT EXISTS referral_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  referral_profile_id UUID NOT NULL REFERENCES referral_profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_provider TEXT NOT NULL DEFAULT 'stripe',
  provider_transaction_id TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'requested',
    'processing',
    'paid',
    'failed'
  )),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  initiated_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  referred_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  qualifying_payment_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL CHECK (status IN (
    'pending',
    'available',
    'processing',
    'paid',
    'cancelled',
    'revoked'
  )),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  payout_id UUID REFERENCES referral_payouts(id) ON DELETE SET NULL,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_commissions_payment_unique UNIQUE (qualifying_payment_id),
  CONSTRAINT referral_commissions_referral_unique UNIQUE (referral_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_commissions_one_per_client
  ON referral_commissions (referred_client_id)
  WHERE referred_client_id IS NOT NULL
    AND status NOT IN ('cancelled', 'revoked');

ALTER TABLE credit_funding_applications
  ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credit_funding_applications_referral
  ON credit_funding_applications (referral_id);

ALTER TABLE referral_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_payouts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE referral_profiles IS
  'One referral link per credit repair client. Stripe Connect account id is a token, not bank credentials.';
COMMENT ON TABLE referral_commissions IS
  'One $50 (configurable) commission per qualifying credit repair invoice, created from invoice.paid.';
