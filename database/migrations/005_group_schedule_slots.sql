ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS schedule_slots JSONB;

UPDATE groups
SET schedule_slots = (
  SELECT jsonb_agg(jsonb_build_object('day', day_value, 'time', to_char(schedule_time, 'HH24:MI')))
  FROM unnest(schedule_days) AS days(day_value)
)
WHERE schedule_slots IS NULL;

ALTER TABLE groups
  ALTER COLUMN schedule_slots SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE groups
    ADD CONSTRAINT groups_schedule_slots_count_check
    CHECK (jsonb_typeof(schedule_slots) = 'array' AND jsonb_array_length(schedule_slots) BETWEEN 1 AND 3);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
