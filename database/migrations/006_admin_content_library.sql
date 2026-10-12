CREATE TABLE IF NOT EXISTS admin_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_homeworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES admin_lessons(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES admin_homeworks(id) ON DELETE CASCADE,
  type question_type NOT NULL,
  text TEXT NOT NULL,
  image_url VARCHAR(500),
  points NUMERIC(7,2) NOT NULL DEFAULT 1 CHECK (points >= 0),
  order_index INT NOT NULL DEFAULT 0,
  correct_boolean BOOLEAN
);

CREATE TABLE IF NOT EXISTS admin_question_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES admin_questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0
);

ALTER TABLE homeworks
  ADD COLUMN IF NOT EXISTS admin_homework_id UUID REFERENCES admin_homeworks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by_admin_id UUID REFERENCES super_admins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_lessons_admin ON admin_lessons(admin_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_lessons_admin_name ON admin_lessons(admin_id, name);
CREATE INDEX IF NOT EXISTS idx_admin_homeworks_admin ON admin_homeworks(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_homeworks_lesson ON admin_homeworks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_admin_questions_homework ON admin_questions(homework_id);
CREATE INDEX IF NOT EXISTS idx_admin_choices_question ON admin_question_choices(question_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_admin_template_group ON homeworks(admin_homework_id, group_id);
