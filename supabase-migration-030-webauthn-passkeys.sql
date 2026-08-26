-- Migration 030: Add WebAuthn/Passkey support for staff authentication
-- Passkeys can be used as passwordless login or as MFA alternative to TOTP
-- Project: hvsoeezsbvwsrdobvgaz. Service role / Next.js only (RLS deny-by-default).

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT,
  backed_up BOOLEAN DEFAULT false,
  transports TEXT[],
  friendly_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_credential_id ON webauthn_credentials(credential_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires ON webauthn_challenges(expires_at);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS passkey_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_credentials FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE webauthn_credentials FROM anon, authenticated, PUBLIC;

ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_challenges FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE webauthn_challenges FROM anon, authenticated, PUBLIC;

COMMENT ON TABLE webauthn_credentials IS 'Stores WebAuthn/passkey credentials for passwordless and MFA authentication';
COMMENT ON TABLE webauthn_challenges IS 'Temporary challenge storage for WebAuthn registration and authentication flows';
COMMENT ON COLUMN users.passkey_enabled IS 'When true, staff may use a registered passkey for passwordless login or MFA';
COMMENT ON COLUMN webauthn_credentials.public_key IS 'Base64url-encoded COSE public key';
