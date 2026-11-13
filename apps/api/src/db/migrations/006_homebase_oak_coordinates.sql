ALTER TABLE homebase_starter_oak ADD COLUMN x integer, ADD COLUMN y integer;

-- Preserve the exact anchors from the original two-slot garden.
UPDATE homebase_starter_oak
SET x = CASE slot_id WHEN 'northwest-lawn' THEN 112 WHEN 'northeast-lawn' THEN 176 END,
    y = CASE WHEN slot_id IN ('northwest-lawn', 'northeast-lawn') THEN 104 END;

ALTER TABLE homebase_starter_oak
  ALTER COLUMN x SET NOT NULL,
  ALTER COLUMN y SET NOT NULL,
  ALTER COLUMN slot_id DROP NOT NULL,
  ADD CONSTRAINT homebase_oak_grid CHECK (x >= 0 AND x < 288 AND y >= 0 AND y < 240 AND x % 8 = 0 AND y % 8 = 0);
