# Shared coastline pilot

Open **Expand coast** on the main **Home Base** island. The preview draws the
proposed terrain and exposed shoreline, but it is local until **Add one tile**
succeeds. Tap a marked tile or use **Next tile** to switch the preview.
**Cancel** discards the draft without writing. **Bay prototype** is unchanged:
it has independent, device-only storage.

- Every eligible cell shares a full side with the original southwest coast:
  columns 7–14, row 15 (zero-based isometric cells). An island starts with no
  additions, can save up to eight, and still has the same 18 × 15 meadow grid,
  projection, drawing frame, and coordinates for cottages, placements, and
  piers. New tiles extend the top of the raised forest rim. Tap a confirmed
  turf tile and choose **Move here** to walk up the short limestone steps,
  along the protected rim, and out onto the tile. The same route leads back
  to the meadow; gaps and unsaved previews are not walkable. The new terrain
  does not unlock garden placements.
- The east pier, mooring and sea channel remain open. The ground, sandstone,
  and foam are repainted against the exact extended coastline, not a larger
  rectangular landmass.
- Members see the same shape after reopening Home Base or refreshing their
  session. The focused island also checks for updates about every 15 seconds
  in the foreground. Guests can see the saved coast but cannot edit it.
- `GET /api/v1/homebases/:homebaseId/expansion` returns
  `{ "additions": [{ "col": 10, "row": 15 }] }` (or an empty list).
  `PUT` on the same path accepts exactly one body such as
  `{ "col": 10, "row": 15 }`, and returns the whole committed list. A duplicate
  confirmation is a successful no-op; wrong coordinates are rejected.
  Nonmembers cannot read or write another island's coastline.
- Run `pnpm --filter @beside/api db:migrate` before serving the updated app.
  Migration `013_homebase_expansion.sql` adds a table keyed by island and tile;
  it does not backfill or rewrite any existing records.
