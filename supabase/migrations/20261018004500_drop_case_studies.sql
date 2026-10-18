-- Remove case studies from the database.
-- Safe to run more than once.
--
-- Do not DELETE FROM storage.objects or storage.buckets here.
-- Supabase rejects those deletes (storage.protect_delete) because they
-- leave the files behind. Empty and delete the client-case-studies
-- bucket from Dashboard → Storage.

DROP POLICY IF EXISTS "client_case_studies_select_public" ON storage.objects;

DROP TABLE IF EXISTS public.client_case_studies;
