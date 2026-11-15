-- Precursor rewards. Everything in a home base's garden is a garden_object:
-- PR #14's free starter oak and every item earned through a milestone. An
-- upgrade (Christmas tree, the next cottage stage) changes an existing object
-- in place, so the object keeps its spot and history. Earned objects start
-- unplaced (x, y null) until a member places them; any member can move them.
CREATE TABLE garden_object (
  id text PRIMARY KEY,
  homebase_id text NOT NULL REFERENCES homebase(id),
  item_id text NOT NULL REFERENCES reward_item(id),
  origin text NOT NULL DEFAULT 'reward' CHECK (origin IN ('reward', 'starter')),
  -- Bottom-centre anchor on the 8 px meadow grid, like the starter oak.
  x integer,
  y integer,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK ((x IS NULL) = (y IS NULL)),
  CHECK (x IS NULL OR (x >= 0 AND x < 288 AND y >= 0 AND y < 240 AND x % 8 = 0 AND y % 8 = 0)),
  row_order bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX garden_object_homebase ON garden_object(homebase_id);
CREATE UNIQUE INDEX garden_object_starter ON garden_object(homebase_id)
  WHERE origin = 'starter';

-- The starter oak becomes the base's first garden object, at the same spot, so
-- it can be decorated and moved like anything else.
DO $$
BEGIN
  IF to_regclass('homebase_starter_oak') IS NOT NULL THEN
    INSERT INTO garden_object (id, homebase_id, item_id, origin, x, y, created_at, updated_at)
    SELECT 'garden_starter_' || homebase_id, homebase_id, 'oak-tree', 'starter', x, y, now(), now()
    FROM homebase_starter_oak
    ORDER BY homebase_id;
    DROP TABLE homebase_starter_oak;
  END IF;
END $$;

-- The object a reward created or upgraded: null until obtained, and while an
-- obtained upgrade waits for its precursor.
ALTER TABLE reward ADD COLUMN garden_object_id text REFERENCES garden_object(id);
ALTER TABLE reward ADD CONSTRAINT reward_garden_obtained
  CHECK (garden_object_id IS NULL OR obtained_at IS NOT NULL);
-- What an upgrade builds on, chosen when it is planned: an object, or a
-- planned reward that will become one.
ALTER TABLE reward
  ADD COLUMN target_object_id text REFERENCES garden_object(id),
  ADD COLUMN target_reward_id text REFERENCES reward(id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT reward_one_target
    CHECK (target_object_id IS NULL OR target_reward_id IS NULL);
CREATE INDEX reward_garden_object ON reward(garden_object_id);

-- scripts/migrate.ts then syncs the code-owned catalog (new sprites) and turns
-- rewards obtained before this migration into unplaced garden objects.
