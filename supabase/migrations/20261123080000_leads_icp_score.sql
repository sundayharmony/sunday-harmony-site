-- ICP score (0–100) from claude/sunday-harmony-icp.md, separate from the old 0–10 prospect_score.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS icp_score smallint,
  ADD COLUMN IF NOT EXISTS icp_band text,
  ADD COLUMN IF NOT EXISTS icp_data jsonb,
  ADD COLUMN IF NOT EXISTS icp_scored_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_icp_band_idx ON public.leads (icp_band, icp_score DESC);
