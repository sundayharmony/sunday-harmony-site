-- Case study PDFs are now served through /api/case-studies/:id/pdf, which
-- checks the published flag and mints a short-lived Supabase signed URL.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-case-studies', 'client-case-studies', false, 52428800)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "client_case_studies_select_public" ON storage.objects;

UPDATE client_case_studies
SET file_url = '/api/case-studies/' || id::text || '/pdf'
WHERE file_url LIKE '%/storage/v1/object/public/client-case-studies/%'
   OR file_url LIKE '%/storage/v1/object/sign/client-case-studies/%';
