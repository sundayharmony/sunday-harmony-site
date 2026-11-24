-- When a lead entered its current pipeline stage. Applied 2026-11-23.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz;

CREATE OR REPLACE FUNCTION public.leads_stamp_stage_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stage_changed_at := COALESCE(NEW.stage_changed_at, now());
  ELSIF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS leads_stamp_stage_change ON public.leads;
CREATE TRIGGER leads_stamp_stage_change BEFORE INSERT OR UPDATE OF pipeline_stage ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_stamp_stage_change();

UPDATE public.leads SET stage_changed_at = CASE
  WHEN pipeline_stage IN ('contacted', 'responded', 'emailed', 'negotiation') THEN COALESCE(last_contacted_at, updated_at, created_at)
  WHEN pipeline_stage IN ('ready_to_contact', 'researching', 'uncontacted') OR pipeline_stage IS NULL THEN COALESCE(discovered_at, created_at)
  ELSE COALESCE(updated_at, created_at)
END
WHERE stage_changed_at IS NULL;
