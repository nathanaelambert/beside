-- Existing plants are already grown. Only future plantings get a growth epoch.
ALTER TABLE homebase_starter_oak ADD COLUMN growth_started_at timestamptz;
ALTER TABLE reward_placement ADD COLUMN growth_started_at timestamptz;

ALTER TABLE homebase_starter_oak ALTER COLUMN growth_started_at SET DEFAULT now();
ALTER TABLE reward_placement ALTER COLUMN growth_started_at SET DEFAULT now();
