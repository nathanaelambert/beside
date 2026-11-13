-- One free demo oak per home base. Persist a stable map slot, not screen pixels.
CREATE TABLE homebase_starter_oak (
  homebase_id text PRIMARY KEY REFERENCES homebase(id) ON DELETE CASCADE,
  slot_id text NOT NULL
);
