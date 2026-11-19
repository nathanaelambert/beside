# Archipelago + manually placed rewards

- Preserve the archipelago merge as a merge commit on top of
  `merge/isometric-world`. One home base keeps the original scene, framing,
  integer zoom controls, dock and placement interactions. Several bases use stable
  island positions, palettes, signs, jetties and sailing (instant with reduced
  motion).
- Load each home base’s garden and render its saved oak and reward placements on
  both current and distant islands. A garden that fails to load contributes no
  saved props and cannot be edited. Only wild trees remain as fixed scenery;
  earned rewards wait in their own island’s dock. Keep automatic reward lots and
  the eight-reward allocation deleted. `archipelagoProps` only draws sea scenery,
  boats, signs and jetties.
- Keep meadow pixels unchanged: project anchors as `x / 16, y / 16`, and use tile
  centres for new previews. Taps, suggestions and moves use `checkMeadowPlacement`
  with only that garden’s oak and saved rewards, excluding the reward being moved.
- Key local editor, selection and camera state by island, and the shared loader by
  signed-in user. Sailing cancels a draft; saving blocks sailing controls. Route
  changes discard the old editor even during a write. Responses retain their
  original home-base ID; per-base request ownership rejects superseded responses,
  and garden revisions protect saves from older refreshes. Late responses cannot
  change another island’s editor, selection, camera or errors. Reward links are
  consumed only on their owning island after its garden loads.
- Keep one scene builder and one garden loader. Remove the screen’s independent
  garden loader and duplicate scene assembly; derive the dock and rendered props
  from the same per-base data. Commit the first scene with its garden so a single
  island never flashes without its saved props.
- Keep migrations 001–005 and 008 unchanged. The demo uses HTTP, agrees proposed
  rewards with every roster member before completion logs, and leaves earned
  rewards waiting for manual placement. A configurable localhost port and session
  cache permit isolated runs alongside an existing demo API.
