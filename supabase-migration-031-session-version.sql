-- Migration 031: Invalidate JWTs after password reset/change
-- JWT strategy sessions last up to 30 days for clients; bumping session_version
-- lets the jwt callback drop tokens issued before the password change.
-- Project: hvsoeezsbvwsrdobvgaz. Service role / Next.js only.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
