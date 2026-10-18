-- Remove case studies from the database and storage.
-- Safe to run more than once.

DROP POLICY IF EXISTS "client_case_studies_select_public" ON storage.objects;

DELETE FROM storage.objects
WHERE bucket_id = 'client-case-studies';

DROP TABLE IF EXISTS public.client_case_studies;

DELETE FROM storage.buckets
WHERE id = 'client-case-studies';
