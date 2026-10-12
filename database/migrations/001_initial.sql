CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE question_type AS ENUM ('mcq', 'true_false', 'essay');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM ('in_progress', 'submitted', 'graded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  subject VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id)
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id)
);

CREATE TABLE IF NOT EXISTS centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, teacher_id)
);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, teacher_id),
  FOREIGN KEY (center_id, teacher_id) REFERENCES centers(id, teacher_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  group_id UUID NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_uses INT CHECK (max_uses IS NULL OR max_uses > 0),
  used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (group_id, teacher_id) REFERENCES groups(id, teacher_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  group_id UUID NOT NULL,
  access_code_id UUID REFERENCES access_codes(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, teacher_id),
  UNIQUE (student_id, teacher_id, group_id),
  FOREIGN KEY (group_id, teacher_id) REFERENCES groups(id, teacher_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, teacher_id)
);

CREATE TABLE IF NOT EXISTS homeworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL,
  group_id UUID NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, teacher_id, group_id),
  FOREIGN KEY (lesson_id, teacher_id) REFERENCES lessons(id, teacher_id) ON DELETE CASCADE,
  FOREIGN KEY (group_id, teacher_id) REFERENCES groups(id, teacher_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
  type question_type NOT NULL,
  text TEXT NOT NULL,
  image_url VARCHAR(500),
  points NUMERIC(7,2) NOT NULL DEFAULT 1 CHECK (points >= 0),
  order_index INT NOT NULL DEFAULT 0,
  correct_boolean BOOLEAN,
  UNIQUE (id, homework_id)
);

CREATE TABLE IF NOT EXISTS question_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL,
  student_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  group_id UUID NOT NULL,
  status submission_status NOT NULL DEFAULT 'in_progress',
  auto_score NUMERIC(7,2) NOT NULL DEFAULT 0,
  manual_score NUMERIC(7,2) NOT NULL DEFAULT 0,
  total_score NUMERIC(7,2) GENERATED ALWAYS AS (auto_score + manual_score) STORED,
  max_score NUMERIC(7,2) NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  UNIQUE (homework_id, student_id),
  FOREIGN KEY (homework_id, teacher_id, group_id) REFERENCES homeworks(id, teacher_id, group_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id, teacher_id, group_id) REFERENCES enrollments(student_id, teacher_id, group_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  selected_choice_id UUID REFERENCES question_choices(id) ON DELETE SET NULL,
  selected_boolean BOOLEAN,
  essay_text TEXT,
  is_correct BOOLEAN,
  score NUMERIC(7,2),
  teacher_feedback TEXT,
  UNIQUE (submission_id, question_id),
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_centers_teacher ON centers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_groups_teacher ON groups(teacher_id);
CREATE INDEX IF NOT EXISTS idx_groups_center ON groups(center_id);
CREATE INDEX IF NOT EXISTS idx_access_codes_group ON access_codes(group_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_teacher ON enrollments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_group ON enrollments(group_id);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher ON lessons(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_teacher_group ON homeworks(teacher_id, group_id);
CREATE INDEX IF NOT EXISTS idx_questions_homework ON questions(homework_id);
CREATE INDEX IF NOT EXISTS idx_choices_question ON question_choices(question_id);
CREATE INDEX IF NOT EXISTS idx_submissions_homework ON submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_submission ON answers(submission_id);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
