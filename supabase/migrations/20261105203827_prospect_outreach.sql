-- Migration 053 / 20261105203827_prospect_outreach
-- Personalized prospect outreach queue (DISABLED by default).
-- PREPARE ONLY. Do not apply to production as part of this change.
-- Website leads remain the operational source of truth.
--
-- Security (current Supabase RLS docs):
-- - Enable RLS on every public table.
-- - Revoke default grants from anon / authenticated / PUBLIC.
-- - No policies for anon/authenticated (Next.js uses service_role / secret key and BYPASSRLS).
-- - No SECURITY DEFINER functions.
-- - No views.
-- - Authorization is application-side via users.role (never user_metadata).
--
-- Atomic claim without a database function (PostgREST has no SKIP LOCKED):
--   UPDATE outreach_queue
--   SET status = 'claimed', claimed_by = $worker, claimed_at = now(),
--       lease_expires_at = now() + interval '2 minutes'
--   WHERE id = $id AND status = 'pending'
--   RETURNING *;
-- Concurrent workers that race the same row: only one UPDATE matches.

CREATE TABLE IF NOT EXISTS public.outreach_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  kill_switch boolean NOT NULL DEFAULT true,
  activated_at timestamptz,
  activation_approved_by uuid,
  physical_mailing_address text,
  sender_email text NOT NULL DEFAULT 'sales@sundayharmony.com',
  sender_display_name text NOT NULL DEFAULT 'Sunday Harmony Consulting',
  signer_name text NOT NULL DEFAULT 'Mac',
  company_name text NOT NULL DEFAULT 'Sunday Harmony Consulting',
  cta_label text NOT NULL DEFAULT 'Pick a time',
  cta_url text NOT NULL DEFAULT 'https://www.sundayharmony.com/book',
  daily_send_limit integer NOT NULL DEFAULT 0 CHECK (daily_send_limit >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  history_reconciliation_status text NOT NULL DEFAULT 'unknown'
    CHECK (history_reconciliation_status IN ('unknown', 'unverified_reports_loaded', 'reconciled')),
  provider_history_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_settings_address_not_placeholder CHECK (
    physical_mailing_address IS NULL
    OR length(trim(physical_mailing_address)) >= 12
  )
);

CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outreach_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  subject_template text NOT NULL,
  preheader_template text NOT NULL,
  content_sha256 text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, version)
);

CREATE TABLE IF NOT EXISTS public.outreach_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'unsubscribe',
    'complaint',
    'hard_bounce',
    'operator',
    'already_contacted',
    'already_sent'
  )),
  source text NOT NULL CHECK (source IN ('user', 'provider', 'operator', 'system')),
  confirmation_status text NOT NULL DEFAULT 'confirmed'
    CHECK (confirmation_status IN ('confirmed', 'unverified_report')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email_normalized, reason)
);

CREATE UNIQUE INDEX IF NOT EXISTS outreach_suppressions_unsub_email
  ON public.outreach_suppressions (email_normalized)
  WHERE reason = 'unsubscribe';

CREATE TABLE IF NOT EXISTS public.outreach_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  email_normalized text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  queue_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.outreach_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE RESTRICT,
  template_version_id uuid NOT NULL REFERENCES public.outreach_template_versions(id) ON DELETE RESTRICT,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email_raw text NOT NULL,
  email_normalized text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'claimed',
    'in_flight',
    'accepted',
    'delivered',
    'bounced',
    'needs_review',
    'suppressed',
    'ineligible',
    'blocked_review',
    'cancelled',
    'failed'
  )),
  eligibility_reason text NOT NULL DEFAULT '',
  grounded_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  subject text NOT NULL DEFAULT '',
  preheader text NOT NULL DEFAULT '',
  html_body text NOT NULL DEFAULT '',
  text_body text NOT NULL DEFAULT '',
  payload_sha256 text NOT NULL DEFAULT '',
  provider_idempotency_key text NOT NULL UNIQUE,
  provider_message_id text,
  provider_thread_id text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  accepted_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  contacted_lead_updated_at timestamptz,
  attachment_filename text NOT NULL DEFAULT 'Sunday-Harmony-Consulting-company-presentation.pdf',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, lead_id),
  UNIQUE (campaign_id, email_normalized)
);

CREATE INDEX IF NOT EXISTS outreach_queue_claim_idx
  ON public.outreach_queue (status, next_attempt_at, id)
  WHERE status IN ('pending', 'claimed');

CREATE INDEX IF NOT EXISTS outreach_queue_lead_idx
  ON public.outreach_queue (lead_id);

CREATE TABLE IF NOT EXISTS public.outreach_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.outreach_queue(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  provider text NOT NULL,
  provider_idempotency_key text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN (
    'in_flight',
    'accepted',
    'rejected',
    'timeout',
    'uncertain',
    'skipped_disabled',
    'skipped_kill_switch',
    'skipped_gates'
  )),
  retryable boolean NOT NULL DEFAULT false,
  provider_message_id text,
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (queue_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS outreach_attempts_key_idx
  ON public.outreach_attempts (provider_idempotency_key);

CREATE TABLE IF NOT EXISTS public.outreach_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL CHECK (actor_type IN ('system', 'staff', 'public', 'provider')),
  actor_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_audit_created_idx
  ON public.outreach_audit_events (created_at DESC);

CREATE TABLE IF NOT EXISTS public.outreach_reconciliation_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN (
    'email_bot_report',
    'provider_history',
    'operator_csv'
  )),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'pending_review',
    'applied_as_unverified',
    'reconciled_with_provider'
  )),
  notes text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now(),
  provider_confirmed boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.outreach_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.outreach_reconciliation_imports(id) ON DELETE CASCADE,
  reported_business_name text NOT NULL DEFAULT '',
  business_normalized text NOT NULL DEFAULT '',
  reported_email text,
  email_normalized text,
  reported_outcome text NOT NULL CHECK (reported_outcome IN (
    'sent',
    'null_mx',
    'bounce_550',
    'other'
  )),
  reported_on date,
  match_method text NOT NULL DEFAULT 'none' CHECK (match_method IN (
    'none',
    'exact_email',
    'exact_business'
  )),
  matched_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  treatment text NOT NULL DEFAULT 'block_review' CHECK (treatment IN (
    'block_review',
    'ignore'
  )),
  provider_confirmed boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS outreach_recon_email_idx
  ON public.outreach_reconciliation_items (email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS outreach_recon_business_idx
  ON public.outreach_reconciliation_items (business_normalized)
  WHERE email_normalized IS NULL AND business_normalized <> '';

ALTER TABLE public.outreach_unsubscribe_tokens
  DROP CONSTRAINT IF EXISTS outreach_unsubscribe_tokens_queue_id_fkey;
ALTER TABLE public.outreach_unsubscribe_tokens
  ADD CONSTRAINT outreach_unsubscribe_tokens_queue_id_fkey
  FOREIGN KEY (queue_id) REFERENCES public.outreach_queue(id) ON DELETE SET NULL;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'outreach_settings',
    'outreach_campaigns',
    'outreach_template_versions',
    'outreach_suppressions',
    'outreach_unsubscribe_tokens',
    'outreach_queue',
    'outreach_attempts',
    'outreach_audit_events',
    'outreach_reconciliation_imports',
    'outreach_reconciliation_items'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
  END LOOP;
END $$;

INSERT INTO public.outreach_settings (id, kill_switch, physical_mailing_address, daily_send_limit, history_reconciliation_status)
VALUES (1, true, NULL, 0, 'unknown')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.outreach_campaigns (id, slug, name)
VALUES ('8c0d3a7e-6b21-4f0a-9d55-3e2c1a0b9f10', 'prospect-intro', 'Prospect intro (unapproved draft)')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.outreach_template_versions (
  id, campaign_id, version, subject_template, preheader_template, content_sha256, approved
)
SELECT
  'b31c4e18-2a55-4c8f-90d1-7f6e5d4c3b2a',
  c.id,
  1,
  '{business}: a note from Sunday Harmony',
  'A short note and our company presentation.',
  'pending-app-hash',
  false
FROM public.outreach_campaigns c
WHERE c.slug = 'prospect-intro'
ON CONFLICT (campaign_id, version) DO NOTHING;

INSERT INTO public.outreach_reconciliation_imports (id, source, status, provider_confirmed, notes)
VALUES (
  'd41f5a29-3b66-4d90-81e2-8a7f6e5d4c3b',
  'email_bot_report',
  'applied_as_unverified',
  false,
  'Email Bot reported historical safety exclusions. Unverified assertions, not provider-confirmed events. Do not mutate live lead records from this import.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.outreach_reconciliation_items (
  import_id, reported_business_name, business_normalized, reported_email, email_normalized,
  reported_outcome, reported_on, match_method, treatment, provider_confirmed, notes
)
VALUES
  (
    'd41f5a29-3b66-4d90-81e2-8a7f6e5d4c3b',
    'Egypt Star',
    'egypt star',
    NULL,
    NULL,
    'sent',
    '2026-11-05',
    'exact_business',
    'block_review',
    false,
    'Reported sent today. Unverified. Block/review by exact business name only.'
  ),
  (
    'd41f5a29-3b66-4d90-81e2-8a7f6e5d4c3b',
    'Holiday Coffee',
    'holiday coffee',
    NULL,
    NULL,
    'sent',
    '2026-11-05',
    'exact_business',
    'block_review',
    false,
    'Reported sent today. Unverified. Block/review by exact business name only.'
  ),
  (
    'd41f5a29-3b66-4d90-81e2-8a7f6e5d4c3b',
    'Catmosphere',
    'catmosphere',
    NULL,
    NULL,
    'sent',
    '2026-11-05',
    'exact_business',
    'block_review',
    false,
    'Reported sent today. Unverified. Block/review by exact business name only.'
  ),
  (
    'd41f5a29-3b66-4d90-81e2-8a7f6e5d4c3b',
    'Wise Bean',
    'wise bean',
    'hey@wisebean.com',
    'hey@wisebean.com',
    'null_mx',
    '2026-11-05',
    'exact_email',
    'block_review',
    false,
    'Reported Null MX. Unverified. Do not treat as a permanent provider bounce on the lead record.'
  ),
  (
    'd41f5a29-3b66-4d90-81e2-8a7f6e5d4c3b',
    'Claude''s Corner',
    'claudes corner',
    'claudescorner@comcast.net',
    'claudescorner@comcast.net',
    'bounce_550',
    '2026-11-05',
    'exact_email',
    'block_review',
    false,
    'Reported Comcast 550. Unverified. Do not treat as a provider-confirmed bounce on the lead record.'
  )
ON CONFLICT DO NOTHING;
