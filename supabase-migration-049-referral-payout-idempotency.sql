-- Idempotency for admin "Send payout" on credit-repair referrals.
-- Run this in the Supabase SQL editor after supabase-migration-038-credit-repair-referrals.sql.
-- It is not applied by the Next.js app. Numbered 049 because 048 is the letter ZIP migration.

ALTER TABLE referral_payouts
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_payouts_idempotency_key
  ON referral_payouts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN referral_payouts.idempotency_key IS
  'One Stripe transfer per admin send. A repeated click reuses this key.';
