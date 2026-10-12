ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS schedule_days VARCHAR(20)[];

UPDATE groups
SET schedule_days = ARRAY[schedule_day]
WHERE schedule_days IS NULL;

ALTER TABLE groups
  ALTER COLUMN schedule_days SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE groups
    ADD CONSTRAINT groups_schedule_days_count_check
    CHECK (cardinality(schedule_days) BETWEEN 1 AND 3);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE groups g
SET subject = s.name_en
FROM subjects s
WHERE g.subject_id = s.id AND (g.subject IS NULL OR btrim(g.subject) = '');

CREATE INDEX IF NOT EXISTS idx_groups_schedule_days
  ON groups USING GIN (schedule_days);
