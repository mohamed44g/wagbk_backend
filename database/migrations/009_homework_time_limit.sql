ALTER TABLE homeworks
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

DO $$ BEGIN
  ALTER TABLE homeworks
    ADD CONSTRAINT homeworks_duration_minutes_positive_check
    CHECK (duration_minutes IS NULL OR duration_minutes > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
