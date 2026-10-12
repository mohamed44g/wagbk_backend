CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO subjects (name_ar, name_en, slug)
VALUES
  (U&'\0639\0631\0628\064a', 'Arabic', 'arabic'),
  (U&'\0625\0646\062c\0644\064a\0632\064a', 'English', 'english')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, subject_id)
);

INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT t.id, s.id
FROM teachers t CROSS JOIN subjects s
WHERE s.slug IN ('arabic', 'english')
ON CONFLICT (teacher_id, subject_id) DO NOTHING;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS subject_id UUID;

UPDATE groups g
SET subject_id = s.id
FROM subjects s
WHERE g.subject_id IS NULL AND (
  LOWER(g.subject) = LOWER(s.name_en)
  OR g.subject = s.name_ar
);

UPDATE groups
SET subject_id = (SELECT id FROM subjects WHERE slug = 'arabic')
WHERE subject_id IS NULL;

ALTER TABLE groups
  ALTER COLUMN subject_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE groups
    ADD CONSTRAINT groups_subject_fk FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_subjects_active ON subjects(is_active);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher ON teacher_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject ON teacher_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_groups_subject ON groups(subject_id);
