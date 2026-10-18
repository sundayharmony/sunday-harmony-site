-- Remove case studies from the database.
-- Run this in the Supabase SQL Editor. Safe to run more than once.
--
-- Do not DELETE FROM storage.objects or storage.buckets here.
-- Supabase rejects those deletes (storage.protect_delete) because they
-- leave the files behind. After this script succeeds, open
-- Dashboard → Storage, empty the client-case-studies bucket, then delete it.

DROP POLICY IF EXISTS "client_case_studies_select_public" ON storage.objects;

DROP TABLE IF EXISTS public.client_case_studies;
