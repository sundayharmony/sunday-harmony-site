-- Portal thread attachments and inbound Gmail reply ids.
-- Run this in the Supabase SQL Editor. It is not applied by the Next.js app.
-- Messages stay on public.messages. No second inbox.
-- The app writes with the service role. RLS from migration 024 still denies the public Data API.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS messages_gmail_message_id_key
  ON public.messages (gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;
