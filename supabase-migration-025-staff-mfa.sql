-- Migration 025: Staff MFA (TOTP) columns on users.
-- Project: hvsoeezsbvwsrdobvgaz. Service role / Next.js only (RLS deny-by-default).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret_encrypted TEXT NULL,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS totp_backup_hashes JSONB NULL,
  ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN users.totp_secret_encrypted IS 'AES-GCM encrypted TOTP shared secret (staff MFA)';
COMMENT ON COLUMN users.totp_enabled IS 'When true, staff must pass TOTP after password login';
COMMENT ON COLUMN users.totp_backup_hashes IS 'JSON array of HMAC hashed one-time backup codes';
