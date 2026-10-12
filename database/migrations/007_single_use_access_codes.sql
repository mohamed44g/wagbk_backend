-- Every newly generated access code is for one student only.
-- Preserve unused legacy codes while making already-consumed codes inactive.
UPDATE access_codes
SET is_active = false
WHERE used_count > 0;

UPDATE access_codes
SET max_uses = 1
WHERE used_count = 0;
