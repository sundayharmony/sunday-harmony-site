-- Migration 020 (expanded): Deny-by-default RLS + private storage buckets.
-- IMPORTANT: Run on Sunday Harmony production project only (ref: hvsoeezsbvwsrdobvgaz).
--
-- Next.js uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Policies with USING (true) /
-- WITH CHECK (true) incorrectly grant anon/authenticated full access — remove them.
-- Idempotent: safe to re-run after the original name-only 020.

-- ---------------------------------------------------------------------------
-- 1. Drop permissive policies on public tables (always-true expressions)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname IN (
          'Service role full access',
          'Service role full access meetings'
        )
        OR qual = 'true'
        OR with_check = 'true'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Enable RLS on sensitive tables (no policies = deny anon/authenticated)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users',
    'leads',
    'clients',
    'messages',
    'admin_data',
    'activity_log',
    'files',
    'tasks',
    'notifications',
    'approvals',
    'onboarding_responses',
    'stripe_webhook_events',
    'client_meetings',
    'credit_funding_applications',
    'uploaded_documents',
    'credit_funding_status_history',
    'credit_funding_messages',
    'credit_funding_document_requests',
    'client_case_studies',
    'dispute_sessions',
    'dispute_letter_plans',
    'dispute_letters',
    'staff_messages'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Private buckets (idempotent). Case studies stay public for marketing PDFs.
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id IN ('client-files', 'credit-funding-docs', 'dispute-letters');

-- Drop any SELECT policies that expose private bucket objects to anon/authenticated
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND (
        qual ILIKE '%client-files%'
        OR qual ILIKE '%credit-funding-docs%'
        OR qual ILIKE '%dispute-letters%'
        OR policyname IN (
          'client_files_select_public',
          'client_files_select_public'
        )
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "client_files_select_public" ON storage.objects;
DROP POLICY IF EXISTS client_files_select_public ON storage.objects;
