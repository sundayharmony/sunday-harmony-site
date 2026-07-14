-- Sunday Harmony — Supabase verification queries
-- Run this in Supabase Dashboard → SQL Editor (NOT the Node diagnostic script).
-- The production diagnostic runs locally: npm run diagnostic:prod

-- ---------------------------------------------------------------------------
-- 1. Migration 011 — RLS enabled on credit funding tables
-- Expected: relrowsecurity = true for all rows
-- ---------------------------------------------------------------------------
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN (
  'credit_funding_applications',
  'uploaded_documents',
  'credit_funding_status_history',
  'credit_funding_messages',
  'credit_funding_document_requests'
)
ORDER BY relname;

-- ---------------------------------------------------------------------------
-- 2. Migration 012 — uploaded_documents columns
-- Expected: shared_by, status_history_id, message_id
-- ---------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'uploaded_documents'
  AND column_name IN ('shared_by', 'status_history_id', 'message_id')
ORDER BY column_name;

-- ---------------------------------------------------------------------------
-- 3. Migration 012 — staff_shared allowed in document_type check
-- Expected: constraint definition includes 'staff_shared'
-- ---------------------------------------------------------------------------
SELECT conname AS constraint_name, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.uploaded_documents'::regclass
  AND contype = 'c'
  AND conname LIKE '%document_type%';

-- ---------------------------------------------------------------------------
-- 4. Storage buckets — private vaults vs public marketing
-- Expected: credit-funding-docs / client-files / dispute-letters public=false
--           client-case-studies public=true (intentional)
-- ---------------------------------------------------------------------------
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id IN ('credit-funding-docs', 'client-files', 'dispute-letters', 'client-case-studies')
ORDER BY id;

-- ---------------------------------------------------------------------------
-- 4b. Migration 020 — no always-true policies remain on public tables
-- Expected: 0 rows
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
ORDER BY tablename, policyname;

-- ---------------------------------------------------------------------------
-- 4c. Core CRM / auth tables have RLS enabled
-- Expected: relrowsecurity = true for all rows
-- ---------------------------------------------------------------------------
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'users', 'clients', 'leads', 'admin_data', 'activity_log',
    'messages', 'files', 'notifications', 'client_meetings'
  )
ORDER BY c.relname;

-- ---------------------------------------------------------------------------
-- 5. Core tables exist (migrations 008–010)
-- ---------------------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'credit_funding_applications',
    'credit_funding_status_history',
    'credit_funding_messages',
    'credit_funding_document_requests',
    'client_meetings',
    'activity_log',
    'notifications'
  )
ORDER BY table_name;

-- ---------------------------------------------------------------------------
-- 7. Migration 025 — staff MFA columns on users
-- Expected: totp_secret_encrypted, totp_enabled, totp_backup_hashes, totp_verified_at
-- ---------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN (
    'totp_secret_encrypted',
    'totp_enabled',
    'totp_backup_hashes',
    'totp_verified_at'
  )
ORDER BY column_name;
