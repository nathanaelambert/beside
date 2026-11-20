-- Null means the unlocked stages of a pre-clock activity are already built.
ALTER TABLE activity ADD COLUMN cottage_build jsonb
  CHECK (cottage_build IS NULL OR jsonb_typeof(cottage_build) = 'object');
