CREATE TABLE milestone_schedule (
  id text PRIMARY KEY,
  activity_id text NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  creator_user_id text NOT NULL REFERENCES app_user(id),
  configuration jsonb NOT NULL,
  next_date text NOT NULL,
  generated_count integer NOT NULL DEFAULT 0 CHECK (generated_count >= 0),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL
);
CREATE TABLE milestone_occurrence (
  schedule_id text NOT NULL REFERENCES milestone_schedule(id) ON DELETE CASCADE,
  local_date text NOT NULL,
  milestone_id text NOT NULL UNIQUE REFERENCES milestone(id) ON DELETE CASCADE,
  PRIMARY KEY (schedule_id, local_date)
);
CREATE INDEX milestone_expiry ON milestone(end_at) WHERE policy <> 'open';
