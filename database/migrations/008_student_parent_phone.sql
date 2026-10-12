ALTER TABLE students
  ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(20);

DO $$ BEGIN
  ALTER TABLE students
    ADD CONSTRAINT students_parent_phone_different_check
    CHECK (parent_phone IS NULL OR parent_phone <> phone);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_parent_phone
  ON students(parent_phone);
