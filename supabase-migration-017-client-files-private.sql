-- Make client-files bucket private; access via signed URLs from Next.js API (service role).
-- Run in Supabase SQL Editor after deploying signed-URL code in client-files-storage.ts.

UPDATE storage.buckets
SET public = false
WHERE id = 'client-files';

DROP POLICY IF EXISTS "client_files_select_public" ON storage.objects;

-- Service role used by Next.js bypasses RLS for upload/remove; no public SELECT policy needed.
