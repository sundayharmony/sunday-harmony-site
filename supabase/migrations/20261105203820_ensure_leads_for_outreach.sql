-- Preview databases start empty and only apply files in supabase/migrations/.
-- Production already has public.leads from the original schema (SQL Editor).
-- CREATE TABLE IF NOT EXISTS is a no-op there and unblocks outreach FKs on Preview.

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.leads FROM anon, authenticated, PUBLIC;
