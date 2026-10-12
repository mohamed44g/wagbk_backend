ALTER TABLE students
  ADD COLUMN IF NOT EXISTS academic_year SMALLINT;

UPDATE students
SET academic_year = 1
WHERE academic_year IS NULL;

ALTER TABLE students
  ALTER COLUMN academic_year SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE students
    ADD CONSTRAINT students_academic_year_check CHECK (academic_year IN (1, 2, 3));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS teacher_academic_years (
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  academic_year SMALLINT NOT NULL CHECK (academic_year IN (1, 2, 3)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, academic_year)
);

INSERT INTO teacher_academic_years (teacher_id, academic_year)
SELECT t.id, years.academic_year
FROM teachers t
CROSS JOIN (VALUES (1::smallint), (2::smallint), (3::smallint)) AS years(academic_year)
ON CONFLICT (teacher_id, academic_year) DO NOTHING;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS subject VARCHAR(100),
  ADD COLUMN IF NOT EXISTS academic_year SMALLINT,
  ADD COLUMN IF NOT EXISTS schedule_day VARCHAR(20),
  ADD COLUMN IF NOT EXISTS schedule_time TIME;

UPDATE groups
SET subject = COALESCE(subject, 'غير محدد'),
    academic_year = COALESCE(academic_year, 1),
    schedule_day = COALESCE(schedule_day, 'saturday'),
    schedule_time = COALESCE(schedule_time, TIME '16:00');

ALTER TABLE groups
  ALTER COLUMN subject SET NOT NULL,
  ALTER COLUMN academic_year SET NOT NULL,
  ALTER COLUMN schedule_day SET NOT NULL,
  ALTER COLUMN schedule_time SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE groups
    ADD CONSTRAINT groups_academic_year_check CHECK (academic_year IN (1, 2, 3));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_teacher_academic_years_teacher
  ON teacher_academic_years(teacher_id);

CREATE INDEX IF NOT EXISTS idx_groups_year_subject
  ON groups(academic_year, subject);
