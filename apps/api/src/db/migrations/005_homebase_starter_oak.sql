-- One free demo oak per home base, persisted in shared world coordinates.
CREATE TABLE homebase_starter_oak (
  homebase_id text PRIMARY KEY REFERENCES homebase(id) ON DELETE CASCADE,
  x integer NOT NULL,
  y integer NOT NULL,
  CONSTRAINT homebase_oak_grid CHECK (x >= 0 AND x < 288 AND y >= 0 AND y < 240 AND x % 8 = 0 AND y % 8 = 0)
);
