-- Experian security-question answer and 4-digit PIN for staff login.
-- Run in Supabase SQL Editor after prior credit-funding migrations.

ALTER TABLE credit_funding_applications
  ADD COLUMN IF NOT EXISTS experian_security_answer_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS experian_pin_encrypted TEXT;
