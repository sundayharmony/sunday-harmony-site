-- Staff-to-staff 1:1 messages.
-- Run this in the Supabase SQL Editor. It is not applied by the Next.js app.
-- Numbered 050 because 049 is referral payout idempotency and 048 is letter ZIP.
--
-- The app writes with the service role, which bypasses RLS. Each API route still
-- checks the staff session and thread membership. RLS denies the public Data API,
-- and the policies below only allow a participant if table privileges are granted
-- later. Triggers also reject a non-staff pair and a sender who is not in the thread.
-- Client messages (`messages`, `/api/admin/messages`) are not changed.

CREATE TABLE IF NOT EXISTS public.staff_direct_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_low UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_high UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_body TEXT,
  last_sender_id UUID,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_direct_threads_ordered CHECK (participant_low < participant_high),
  CONSTRAINT staff_direct_threads_pair UNIQUE (participant_low, participant_high)
);

CREATE INDEX IF NOT EXISTS idx_staff_direct_threads_participant_high
  ON public.staff_direct_threads (participant_high);

CREATE TABLE IF NOT EXISTS public.staff_direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.staff_direct_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_direct_messages_body_len CHECK (
    char_length(btrim(body)) > 0 AND char_length(body) <= 10000
  )
);

CREATE INDEX IF NOT EXISTS idx_staff_direct_messages_thread_created
  ON public.staff_direct_messages (thread_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.staff_direct_reads (
  thread_id UUID NOT NULL REFERENCES public.staff_direct_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE OR REPLACE FUNCTION public.staff_direct_participants_are_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  low_role TEXT;
  high_role TEXT;
BEGIN
  SELECT role INTO low_role FROM public.users WHERE id = NEW.participant_low;
  SELECT role INTO high_role FROM public.users WHERE id = NEW.participant_high;
  IF low_role IS NULL OR high_role IS NULL
     OR low_role NOT IN ('admin', 'credit_manager', 'lead_procurement', 'sales_closer', 'client_relations')
     OR high_role NOT IN ('admin', 'credit_manager', 'lead_procurement', 'sales_closer', 'client_relations')
  THEN
    RAISE EXCEPTION 'staff direct threads are limited to internal staff'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_direct_threads_staff_only ON public.staff_direct_threads;
CREATE TRIGGER staff_direct_threads_staff_only
  BEFORE INSERT OR UPDATE OF participant_low, participant_high
  ON public.staff_direct_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.staff_direct_participants_are_staff();

CREATE OR REPLACE FUNCTION public.staff_direct_message_sender_is_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.staff_direct_threads t
    WHERE t.id = NEW.thread_id
      AND (t.participant_low = NEW.sender_id OR t.participant_high = NEW.sender_id)
  ) THEN
    RAISE EXCEPTION 'sender is not a participant in this staff thread'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_direct_messages_member_only ON public.staff_direct_messages;
CREATE TRIGGER staff_direct_messages_member_only
  BEFORE INSERT OR UPDATE OF thread_id, sender_id
  ON public.staff_direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.staff_direct_message_sender_is_participant();

CREATE OR REPLACE FUNCTION public.staff_direct_touch_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.staff_direct_threads
  SET last_body = NEW.body,
      last_sender_id = NEW.sender_id,
      last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_direct_messages_touch_thread ON public.staff_direct_messages;
CREATE TRIGGER staff_direct_messages_touch_thread
  AFTER INSERT ON public.staff_direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.staff_direct_touch_thread();

CREATE OR REPLACE FUNCTION public.staff_direct_read_is_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.staff_direct_threads t
    WHERE t.id = NEW.thread_id
      AND (t.participant_low = NEW.user_id OR t.participant_high = NEW.user_id)
  ) THEN
    RAISE EXCEPTION 'only a thread participant can mark it read'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_direct_reads_member_only ON public.staff_direct_reads;
CREATE TRIGGER staff_direct_reads_member_only
  BEFORE INSERT OR UPDATE OF thread_id, user_id
  ON public.staff_direct_reads
  FOR EACH ROW
  EXECUTE FUNCTION public.staff_direct_read_is_participant();

ALTER TABLE public.staff_direct_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_direct_threads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.staff_direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_direct_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.staff_direct_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_direct_reads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_direct_threads_participant ON public.staff_direct_threads;
CREATE POLICY staff_direct_threads_participant
  ON public.staff_direct_threads
  FOR ALL
  TO authenticated
  USING (participant_low = auth.uid() OR participant_high = auth.uid())
  WITH CHECK (participant_low = auth.uid() OR participant_high = auth.uid());

DROP POLICY IF EXISTS staff_direct_messages_participant ON public.staff_direct_messages;
CREATE POLICY staff_direct_messages_participant
  ON public.staff_direct_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_direct_threads t
      WHERE t.id = staff_direct_messages.thread_id
        AND (t.participant_low = auth.uid() OR t.participant_high = auth.uid())
    )
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.staff_direct_threads t
      WHERE t.id = staff_direct_messages.thread_id
        AND (t.participant_low = auth.uid() OR t.participant_high = auth.uid())
    )
  );

DROP POLICY IF EXISTS staff_direct_reads_participant ON public.staff_direct_reads;
CREATE POLICY staff_direct_reads_participant
  ON public.staff_direct_reads
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.staff_direct_threads t
      WHERE t.id = staff_direct_reads.thread_id
        AND (t.participant_low = auth.uid() OR t.participant_high = auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.staff_direct_threads t
      WHERE t.id = staff_direct_reads.thread_id
        AND (t.participant_low = auth.uid() OR t.participant_high = auth.uid())
    )
  );

REVOKE ALL ON TABLE public.staff_direct_threads FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.staff_direct_messages FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.staff_direct_reads FROM anon, authenticated, PUBLIC;

GRANT ALL ON TABLE public.staff_direct_threads TO service_role;
GRANT ALL ON TABLE public.staff_direct_messages TO service_role;
GRANT ALL ON TABLE public.staff_direct_reads TO service_role;

COMMENT ON TABLE public.staff_direct_threads IS
  'One 1:1 thread per staff pair. Service-role API enforces membership; RLS denies the public Data API.';
