-- Migration 020: Remove permissive RLS policies that grant anon/authenticated full access.
-- Service role (used by Next.js API) bypasses RLS; these policies are unsafe if left in place.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE policyname = 'Service role full access'
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Ensure client-files bucket is private (idempotent)
UPDATE storage.buckets SET public = false WHERE id = 'client-files';

-- Remove public read policy on client-files if present
DROP POLICY IF EXISTS client_files_select_public ON storage.objects;
