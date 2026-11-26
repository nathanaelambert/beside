ALTER TABLE reward
  ADD COLUMN upgrade_count integer NOT NULL DEFAULT 0 CHECK (upgrade_count >= 0),
  ADD COLUMN build_ready_at timestamptz,
  ADD CONSTRAINT reward_earned_progress CHECK (
    obtained_at IS NOT NULL OR (upgrade_count = 0 AND build_ready_at IS NULL)
  );

ALTER TABLE milestone
  ADD COLUMN upgrade_reward_id text REFERENCES reward(id),
  ADD COLUMN upgrade_required_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN upgrade_credited_at timestamptz,
  ADD CONSTRAINT milestone_upgrade_plan CHECK (
    jsonb_typeof(upgrade_required_user_ids) = 'array'
    AND (
      (upgrade_reward_id IS NULL AND upgrade_required_user_ids = '[]'::jsonb AND upgrade_credited_at IS NULL)
      OR (upgrade_reward_id IS NOT NULL AND kind = 'achievement' AND reward_id IS NULL
          AND jsonb_array_length(upgrade_required_user_ids) > 0)
    )
  );
CREATE INDEX milestone_upgrade_reward ON milestone(upgrade_reward_id) WHERE upgrade_reward_id IS NOT NULL;

-- Seed the shared catalog item for existing databases as well as fresh installs.
INSERT INTO reward_item (id, name, category, artifact) VALUES
  ('cozy-cottage', 'Cozy cottage', 'Buildings', '{"format":"pixel-art","palette":{"a":"#3b2a2e","b":"#a35e4b","c":"#7d4436","d":"#f0a06a","e":"#c8573a","f":"#a8432a","g":"#d9c9a8","h":"#e07a4a","i":"#4a3a33","j":"#f6d77a","k":"#6b4a33","l":"#efe3c8","m":"#83552f","n":"#e7c66a","o":"#9a9c96"},"pixels":["...............abca.............","...........a...abca.............","...........da..abca.............","...........eddaabca.............","..........aeedddbca.............","..........aeefeedda.............",".........aefeeeeeeddd...........",".........eeefeeeeeedda..........",".........eeeeeefeeefef..........","........aeeeeeeefeeegfa.........","........ahfeeefeeeeeiifa........",".......afhhhfeeeeeejjiff........",".......ahffhhheeeefjjggf........",".......ffhhhfehhfeegggkka.......",".......hhfhhefhhefeggkkkfa......","........alefehhhfhgkkggk........","........aliiehfhhkkggggk........","........aliiklhfhggggggk........","........akkiklijhggggggk........","........alkkklijkgggiggk........","........alilklmikggjjggk........","........aliiklmkkggjjggk........","........aliiklmlkggjjggk........","........alliklnlkggigggk........","........aollklnlkggggggk........",".........aooklmlkggggooo........","...........aooolkggooa..........","............aaookoooa...........","...............aoaa.............","................................","................................","................................"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;
