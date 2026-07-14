-- Migration 024: Nuclear deny for CRM/auth tables (follow-up if 020 left rows exposed).
-- Project: hvsoeezsbvwsrdobvgaz only.
-- Safe with Next.js service_role (BYPASSRLS). Idempotent.
--
-- 1) Drop ALL policies on listed tables (not only USING(true) name matches)
-- 2) ENABLE + FORCE ROW LEVEL SECURITY
-- 3) REVOKE table privileges from anon / authenticated / PUBLIC

DO $$
DECLARE
  t text;
  r RECORD;
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
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      CONTINUE;
    END IF;

    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
  END LOOP;
END $$;

-- Quick sanity (run after apply): should return 0 rows
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('users','clients','leads','admin_data','activity_log');
