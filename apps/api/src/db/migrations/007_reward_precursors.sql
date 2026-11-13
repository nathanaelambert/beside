-- Precursor rewards. Earned items become objects in the home base's garden;
-- an upgrade (Christmas tree, the next cottage stage) changes an existing
-- object in place, so the object keeps its plot and history.
-- Numbered after PR #14's 005/006 so both can merge in either order.
CREATE TABLE garden_object (
  id text PRIMARY KEY,
  homebase_id text NOT NULL REFERENCES homebase(id),
  item_id text NOT NULL REFERENCES reward_item(id),
  -- Bottom-centre anchor in meadow pixels; both null when no plot is free.
  x integer,
  y integer,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK ((x IS NULL) = (y IS NULL)),
  row_order bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX garden_object_homebase ON garden_object(homebase_id);
-- Two objects never share a plot within one garden.
CREATE UNIQUE INDEX garden_object_plot ON garden_object(homebase_id, x, y)
  WHERE x IS NOT NULL;

-- Null until obtained, and while an obtained upgrade waits for its precursor.
ALTER TABLE reward ADD COLUMN garden_object_id text REFERENCES garden_object(id);
ALTER TABLE reward ADD CONSTRAINT reward_garden_obtained
  CHECK (garden_object_id IS NULL OR obtained_at IS NOT NULL);
CREATE INDEX reward_garden_object ON reward(garden_object_id);

-- scripts/migrate.ts then syncs the code-owned catalog (new sprites) and plants
-- rewards obtained before this migration, so every earned item is visible.
