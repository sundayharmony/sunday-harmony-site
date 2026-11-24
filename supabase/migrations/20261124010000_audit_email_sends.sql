-- Free-audit email sequence log (steps 1-3), one row per lead per step. Applied 2026-11-23.
CREATE TABLE IF NOT EXISTS public.audit_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  step smallint NOT NULL CHECK (step IN (1, 2, 3)),
  email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'bounced', 'failed')),
  gmail_message_id text,
  gmail_thread_id text,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  bounce_checked_at timestamptz,
  UNIQUE (lead_id, step)
);
CREATE INDEX IF NOT EXISTS audit_email_sends_sent_at_idx ON public.audit_email_sends (sent_at DESC);
ALTER TABLE public.audit_email_sends ENABLE ROW LEVEL SECURITY;
