-- Reference SQL shape for Playground v2, not a production migration.
-- JSONB stores descriptive fields; relationships use foreign keys and joins.
-- Cross-table ownership, category, unit, and audience rules need command transactions.
-- The event envelope entity_type/entity_id is application-validated, not a SQL FK.

-- Catalog definitions are referenced by milestone rewards. Saved world placements
-- remain outside this reference model.
-- artifact: {format: "pixel-art", palette: {a: "#35533a"}, pixels: [".aa."]}
-- Application validation bounds the grid to 64x64, requires rectangular rows,
-- validates hex colors, and checks that every visible pixel has a palette entry.
CREATE TABLE reward_item (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  category text NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 80),
  artifact jsonb NOT NULL CHECK (artifact->>'format' = 'pixel-art')
);
CREATE INDEX reward_item_category_idx ON reward_item(category);

CREATE TABLE app_user (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  color text NOT NULL
);

-- Existing JSON keeps the connections/memberships keys and connection_id names.
CREATE TABLE homebase (
  id text PRIMARY KEY,
  name text NOT NULL,
  personal_owner_id text UNIQUE REFERENCES app_user(id)
);

CREATE TABLE homebase_member (
  id text PRIMARY KEY,
  connection_id text NOT NULL REFERENCES homebase(id),
  user_id text NOT NULL REFERENCES app_user(id),
  UNIQUE (connection_id, user_id)
);

CREATE TABLE subject_template (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  fields jsonb NOT NULL,
  unit text NOT NULL
);

CREATE TABLE activity_template (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  progress_mode text NOT NULL,
  unit text NOT NULL,
  target numeric NOT NULL,
  CHECK (target > 0),
  CHECK (progress_mode IN ('position', 'sum', 'sessions'))
);

CREATE TABLE subject (
  id text PRIMARY KEY,
  template_id text NOT NULL REFERENCES subject_template(id),
  owner_user_id text NOT NULL REFERENCES app_user(id),
  title text NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE activity (
  id text PRIMARY KEY,
  template_id text NOT NULL REFERENCES activity_template(id),
  creator_user_id text NOT NULL REFERENCES app_user(id),
  personal_owner_id text REFERENCES app_user(id),
  connection_id text REFERENCES homebase(id),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  progress_mode text NOT NULL,
  unit text NOT NULL,
  created_at timestamptz NOT NULL,
  CHECK ((personal_owner_id IS NULL) <> (connection_id IS NULL)),
  CHECK (progress_mode IN ('position', 'sum', 'sessions'))
);

CREATE TABLE activity_subject (
  id text PRIMARY KEY,
  activity_id text NOT NULL REFERENCES activity(id),
  subject_id text NOT NULL REFERENCES subject(id),
  UNIQUE (activity_id, subject_id)
);

CREATE TABLE participation (
  id text PRIMARY KEY,
  activity_id text NOT NULL REFERENCES activity(id),
  user_id text NOT NULL REFERENCES app_user(id),
  target numeric NOT NULL,
  status text NOT NULL,
  UNIQUE (activity_id, user_id),
  CHECK (target > 0),
  CHECK (status IN ('invited', 'active', 'finished', 'left'))
);

CREATE TABLE reward (
  id text PRIMARY KEY,
  homebase_id text NOT NULL REFERENCES homebase(id),
  item_id text NOT NULL REFERENCES reward_item(id),
  obtained_at timestamptz,
  -- Application validates a nonempty unique roster of activity participants.
  required_user_ids jsonb NOT NULL CHECK (jsonb_typeof(required_user_ids) = 'array' AND jsonb_array_length(required_user_ids) > 0)
);

CREATE TABLE milestone (
  id text PRIMARY KEY,
  activity_id text NOT NULL REFERENCES activity(id),
  parent_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('join', 'achievement')),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  quantity numeric NOT NULL CHECK (quantity > 0),
  policy text NOT NULL CHECK (policy IN ('open', 'paced', 'deadline')),
  start_at timestamptz,
  end_at timestamptz,
  reward_id text UNIQUE REFERENCES reward(id),
  created_at timestamptz NOT NULL,
  UNIQUE (activity_id, id),
  FOREIGN KEY (activity_id, parent_id) REFERENCES milestone(activity_id, id) DEFERRABLE INITIALLY DEFERRED,
  CHECK ((kind = 'join' AND parent_id = id AND reward_id IS NULL AND quantity = 1 AND policy = 'open') OR (kind = 'achievement' AND parent_id <> id)),
  CHECK (start_at IS NULL OR end_at IS NULL OR start_at < end_at),
  CHECK ((policy = 'open' AND start_at IS NULL AND end_at IS NULL) OR (policy = 'paced' AND start_at IS NOT NULL AND end_at IS NOT NULL) OR (policy = 'deadline' AND start_at IS NULL AND end_at IS NOT NULL))
);
CREATE UNIQUE INDEX milestone_zero_per_activity ON milestone(activity_id) WHERE kind = 'join';
-- Commands also require at least one root, acyclic ancestry, and matching reward scope.

CREATE TABLE activity_log (
  id text PRIMARY KEY,
  author_user_id text NOT NULL REFERENCES app_user(id),
  -- Nullable only for preserved v1 history; every new command requires this FK.
  milestone_id text REFERENCES milestone(id),
  is_success boolean NOT NULL,
  subject_id text REFERENCES subject(id),
  category text NOT NULL,
  title text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  duration_minutes numeric NOT NULL,
  occurred_at timestamptz NOT NULL,
  origin text NOT NULL,
  external_key text,
  created_at timestamptz NOT NULL,
  UNIQUE (author_user_id, origin, external_key),
  CHECK (quantity > 0),
  CHECK (duration_minutes >= 0),
  CHECK (origin IN ('manual', 'voice', 'mcp', 'automation'))
);

CREATE TABLE log_share (
  id text PRIMARY KEY,
  log_id text NOT NULL REFERENCES activity_log(id),
  connection_id text NOT NULL REFERENCES homebase(id),
  shared_by_user_id text NOT NULL REFERENCES app_user(id),
  UNIQUE (log_id, connection_id)
);

CREATE TABLE log_contribution (
  id text PRIMARY KEY,
  log_id text NOT NULL REFERENCES activity_log(id),
  participation_id text NOT NULL REFERENCES participation(id),
  amount numeric NOT NULL,
  UNIQUE (log_id, participation_id),
  CHECK (amount > 0)
);

CREATE TABLE domain_event (
  id text PRIMARY KEY,
  actor_user_id text NOT NULL REFERENCES app_user(id),
  type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  message text NOT NULL,
  origin text NOT NULL,
  created_at timestamptz NOT NULL,
  CHECK (entity_type IN ('subject', 'activity', 'log', 'milestone', 'reward'))
);

CREATE TABLE event_delivery (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES domain_event(id),
  recipient_user_id text NOT NULL REFERENCES app_user(id),
  connection_id text REFERENCES homebase(id),
  kind text NOT NULL,
  UNIQUE (event_id, recipient_user_id),
  CHECK (kind IN ('private', 'update', 'progress', 'activity'))
);

CREATE UNIQUE INDEX milestone_success_once ON activity_log(milestone_id, author_user_id) WHERE is_success AND milestone_id IS NOT NULL;
CREATE INDEX milestone_activity ON milestone(activity_id);
CREATE INDEX reward_homebase ON reward(homebase_id);
CREATE INDEX participation_user ON participation(user_id);
CREATE INDEX activity_scope ON activity(connection_id, personal_owner_id);
CREATE INDEX subject_owner ON subject(owner_user_id);
CREATE INDEX log_author_time ON activity_log(author_user_id, occurred_at);
CREATE INDEX share_audience ON log_share(connection_id);
CREATE INDEX contribution_progress ON log_contribution(participation_id);
CREATE INDEX delivery_inbox ON event_delivery(recipient_user_id);

-- Progress: position uses MAX(amount); sessions and sum use SUM(amount).
-- Recurring periods and historical target versions remain future experiments.

-- All commands run atomically with their events and deliveries. Join/failure logs
-- never contribute. Successful achievements credit only their own activity.
-- Schedules use submission time, inclusive at start/end; reported occurrence time
-- cannot bypass a closed window. A reward is obtained once all saved users succeed.
