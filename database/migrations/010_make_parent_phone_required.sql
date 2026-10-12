-- Migration 010: Make parent_phone required (NOT NULL) and backfill existing students with placeholder phone numbers
UPDATE students
SET parent_phone = '011' || LPAD((10000000 + (random() * 89999999)::integer)::text, 8, '0')
WHERE parent_phone IS NULL OR TRIM(parent_phone) = '';

ALTER TABLE students
  ALTER COLUMN parent_phone SET NOT NULL;
