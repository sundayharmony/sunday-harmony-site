-- Client file vault: public Storage bucket for objects uploaded via Next.js API (service role).
-- Run in Supabase SQL Editor. You can instead create bucket "client-files" as Public in Dashboard → Storage.
-- App code: src/lib/client-files-storage.ts (bucket id must match).

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-files', 'client-files', true, 4194304)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- Allow read access for public bucket URLs (if your project enforces RLS on storage.objects).
DROP POLICY IF EXISTS "client_files_select_public" ON storage.objects;
CREATE POLICY "client_files_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-files');
