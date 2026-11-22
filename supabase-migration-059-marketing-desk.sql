-- Marketing desk: a saved consultation date and a recorded reply.
-- Does not rename pipeline_stage values.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS consultation_booked_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
