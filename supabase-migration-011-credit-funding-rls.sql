-- Defense-in-depth: deny direct anon/authenticated access to credit funding data.
-- Server routes use the service role key, which bypasses RLS.

ALTER TABLE credit_funding_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_funding_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_funding_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_funding_document_requests ENABLE ROW LEVEL SECURITY;

-- No permissive policies: only service role (used by Next.js API routes) can read/write.
