-- Experiment: tiered rewards bought with a shared currency (acorns).
-- Numbered 007 to leave 005/006 to the open starter-oak change (PR #14).
-- Each home base has one acorn pool. The ledger is the source of truth; the
-- balance is the sum of its amounts and may never go below zero.
CREATE TABLE homebase_decoration (
  id text PRIMARY KEY,
  homebase_id text NOT NULL REFERENCES homebase(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES reward_item(id),
  price integer NOT NULL CHECK (price >= 0),
  purchased_by_user_id text NOT NULL REFERENCES app_user(id),
  x integer NOT NULL,
  y integer NOT NULL,
  external_key text,
  created_at timestamptz NOT NULL,
  row_order bigint GENERATED ALWAYS AS IDENTITY,
  CHECK (x >= 0 AND x < 288 AND y >= 0 AND y < 240 AND x % 8 = 0 AND y % 8 = 0)
);
CREATE INDEX homebase_decoration_base ON homebase_decoration(homebase_id);
CREATE UNIQUE INDEX homebase_decoration_retry
  ON homebase_decoration(purchased_by_user_id, external_key)
  WHERE external_key IS NOT NULL;

CREATE TABLE acorn_entry (
  id text PRIMARY KEY,
  homebase_id text NOT NULL REFERENCES homebase(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_user(id),
  amount integer NOT NULL,
  kind text NOT NULL,
  -- Earned acorns stay when a milestone is deleted; the note keeps the history.
  milestone_id text REFERENCES milestone(id) ON DELETE SET NULL,
  decoration_id text REFERENCES homebase_decoration(id) ON DELETE SET NULL,
  note text NOT NULL CHECK (length(note) <= 500),
  created_at timestamptz NOT NULL,
  row_order bigint GENERATED ALWAYS AS IDENTITY,
  CHECK (kind IN ('check-in', 'together', 'purchase', 'refund')),
  CHECK ((kind = 'purchase') = (amount < 0) AND amount <> 0)
);
CREATE INDEX acorn_entry_base ON acorn_entry(homebase_id);
-- One check-in payment per person and one together bonus per milestone.
CREATE UNIQUE INDEX acorn_entry_check_in_once
  ON acorn_entry(milestone_id, user_id) WHERE kind = 'check-in';
CREATE UNIQUE INDEX acorn_entry_together_once
  ON acorn_entry(milestone_id) WHERE kind = 'together';
