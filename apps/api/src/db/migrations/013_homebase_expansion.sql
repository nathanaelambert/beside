-- Existing home bases have no added tiles; their base meadow never moves.
CREATE TABLE homebase_expansion_tile (
  homebase_id text NOT NULL REFERENCES homebase(id) ON DELETE CASCADE,
  tile_col integer NOT NULL CHECK (tile_col BETWEEN 7 AND 14),
  tile_row integer NOT NULL CHECK (tile_row = 15),
  PRIMARY KEY (homebase_id, tile_col, tile_row)
);
