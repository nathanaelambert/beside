-- Equal-value rewards: every milestone earns exactly one catalog item, so the
-- only "price" is the group agreeing that the item fits the milestone.
-- An agreement endorses one specific item. Changing the milestone's item leaves
-- old rows in place, but they no longer match reward.item_id and stop counting.
CREATE TABLE reward_agreement (
  reward_id text NOT NULL REFERENCES reward(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES reward_item(id),
  agreed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reward_id, user_id)
);

-- Where an earned reward stands in its home base's meadow. Uses the same world
-- grid as the starter oak (migration 006). Rows outside the domain snapshot, like
-- the starter oak, so the playground model stays unchanged.
CREATE TABLE reward_placement (
  reward_id text PRIMARY KEY REFERENCES reward(id) ON DELETE CASCADE,
  x integer NOT NULL,
  y integer NOT NULL,
  placed_by text REFERENCES app_user(id) ON DELETE SET NULL,
  placed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reward_placement_grid CHECK (x >= 0 AND x < 288 AND y >= 0 AND y < 240 AND x % 8 = 0 AND y % 8 = 0)
);
