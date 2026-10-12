WITH new_subjects (name_ar, name_en, slug) AS (
  VALUES
    ('تاريخ', 'History', 'history'),
    ('جغرافيا', 'Geography', 'geography'),
    ('فرنساوي', 'French', 'french'),
    ('رياضيات', 'Mathematics', 'mathematics'),
    ('كيمياء', 'Chemistry', 'chemistry'),
    ('فيزياء', 'Physics', 'physics'),
    ('أحياء', 'Biology', 'biology'),
    ('فلسفة', 'Philosophy', 'philosophy'),
    ('إحصاء', 'Statistics', 'statistics'),
    ('اقتصاد ومحاسبة', 'Economics and Accounting', 'economics-accounting'),
    ('برمجة وذكاء اصطناعي', 'Programming and Artificial Intelligence', 'programming-ai')
)
INSERT INTO subjects (name_ar, name_en, slug)
SELECT candidate.name_ar, candidate.name_en, candidate.slug
FROM new_subjects candidate
WHERE NOT EXISTS (
  SELECT 1
  FROM subjects existing
  WHERE existing.slug = candidate.slug
     OR LOWER(existing.name_ar) = LOWER(candidate.name_ar)
)
ON CONFLICT (slug) DO NOTHING;
