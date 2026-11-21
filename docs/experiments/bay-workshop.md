# Bay workshop (issue #30)

Open **Bay prototype** from Home Base in the mobile app or Expo Web. This
separate prototype uses the existing isometric renderer, with an open bay,
pixel-painted rock, moss, sea foam, and the archipelago's wooden pier.

- **Expand the bay** previews one legal shoreline tile. Tap a highlighted
  spot or use **Next tile** to select; **Add one tile** commits it and
  **Cancel** leaves the saved shape untouched. The bay and the pier's water
  approach remain open. Each shape can grow by up to 12 connected cells.
- The map frame, cottage plot, and pier have fixed world coordinates. New
  cells replace sea in the frame; they do not rebase existing objects.
- **Original art** and **Detailed art** compare the same camera, layout,
  and placed objects. **Terracotta**, **Woodland**, **Plum**, **Moss**, and
  **Clubhouse** select roof designs, coastal materials, and garden accents.
- **Bay** shows the island textures, the four existing member-avatar styles
  (with their blink and breathing frames), and the cottage previews. Each
  Detailed style shows **Starter cottage → Reading wing → Loft**; Original
  art still shows the older construction previews.
- **Garden** lets you browse all 12 catalogue props in the same sample spot:
  three trees, three flowers, two statues, two flags, a bench, and a lantern.
  In Detailed art, trees show **Sprout → Young → Mature**, and flowers show
  **Sprout → Bud → In bloom**. These previews do not grow or earn rewards.
- **Harbor** shows the pier, rowboat, buoy, sea rock, and sign in place. The
  samples are static; the existing navigation and rowboat travel are not
  changed.
- Expansions are stored on the current device, keyed by home base. No
  live island, activity, milestone, or reward is changed. Multi-device
  persistence and placing real rewards on expanded land are outside this
  prototype.

## Terracotta art trial

The original trial generated three transparent sprites separately using the
approved bay illustration as an image reference and matching its isometric light.
The cottage brief called for a clay-tile roof, cream plaster, green shutters,
and a flower box; the oak for layered foliage and a rooted trunk; and the
down-right pier for readable planks and timber posts. The PNGs in
`apps/mobile/assets/images/bay-art` use a 3× raster inside each original
logical sprite rectangle, with transparent padding to keep their ground
contacts aligned.

The expanded trial reuses the three Terracotta sprites and adds authored
construction art, material ramps and highlight clusters for the catalog,
plant growth frames, and a 2× raster treatment for the same avatar frames.
Terrain materials do not change land cells, elevation, footprint, or draw
order. Bay Workshop remains the before/after gallery; Home Base uses the
detailed art by default.

### Home Base rollout

- Cottages use their existing saved plot, roof assignment, unlock thresholds,
  and server construction deadlines.
- All roof styles start as finished small cottages, even while the first
  clock runs. At 1 and 3 milestones, a reading wing and then a loft are
  added around the same front step. Each style retains its own palette and
  architectural details (e.g. Woodland timber and the Clubhouse double
  doors). The transparent sprites share a 64 × 70 logical canvas; their
  silhouettes are used for taps.
- New player-planted trees and flowers show a sprout immediately, a young tree
  or bud after 10 seconds, and mature art after 20 seconds. A server timestamp
  anchors those purely visual changes across reloads and devices. Moving a
  reward changes its saved position, but never resets the timestamp.
- Existing plants stay fully grown; map trees remain fully grown. No changes
  to reward rules, occupancy, coordinate formats, or cottage timers.
- Detailed foliage has a stepped idle breeze in Home Base and Bay Workshop.
  Map and garden trees, shrubs, and flowers move only above their anchored
  trunks or stems. Shadows, placement previews, and stone and wood structures
  stay still. Reduced Motion skips the foliage animation.
- Oaks, pines, and cherry trees in Detailed art share one family of sprites
  at every growth stage. The same species and stage use the same sprite
  whether planted by a player or placed by the landscape. The PNGs in
  `apps/mobile/assets/images/tree-family` share upper-left light,
  restrained highlights, bark tones, and one grounded 32 × 32 logical
  cell. They reuse the original anchors, growth timings, and breeze.
- Sunflower, blush tulip, and lavender keep their own leaf and bloom shapes
  from sprout to full bloom, with the same palette and upper-left light as
  the garden trees. Their sprites in `apps/mobile/assets/images/flower-family`
  use one grounded 32 × 32 logical cell and the same texture in the garden
  preview, Home Base, and the garden's item details.
- Detailed grass uses warm olive tones and staggered blade clusters painted
  across tile seams. Forest-rim shrubs share the oak's upper-left lighting
  and clustered leaves; their original mask, anchor, and breeze are kept.
  The ground still uses each island's established seasonal palette.
- Harbor wood uses honeyed boards, seams and pegs on the pond deck and
  procedural pier. The Terracotta and archipelago pier texture keeps its
  original mask and anchor, with a matching RGB finish. Garden lanterns
  echo the cottage's limestone and amber window light, without changing
  their placement, silhouette, or the boat's mooring point.
- Detailed water has quiet offshore currents and turquoise shallows at
  existing pond banks. Coastal stone uses staggered ledges, olive moss and
  damp bases; the broken cream crests reuse the existing foam mask.
  Boulders and gulls keep their silhouettes and positions. This only changes
  color and texture, not tile geometry, expansion rules or navigation.
- Detailed walks share staggered, worn limestone flags across tile seams.
  Fine sand ripples stay inside the existing sand tiles, with a darker
  damp belt only where they touch pond water. Neither layer adds objects
  or changes any tile kind, elevation, or route.
- The picnic blanket uses warm woven checks and a stitched hem inside the
  existing inset. Its original island color variants still apply. Reading
  benches share the pier's timber and the lantern's limestone, keeping
  their original silhouettes, saved positions, and selection targets.


### Focused Terracotta material pass

- Terracotta's starter, reading wing and loft keep their original native 3×
  masks, front step and portal pixels. The clay roof groups light along the
  ridge into broader planes; other cottage textures are unchanged.
- The same four detailed member portraits use authored upper-left planes on
  their original silhouettes and retain their logical size, step, blink and
  breath. The original flat avatar art remains available in Original art.
- The reading bench keeps the stone supports, book, hit mask and center; only
  the timber, support and seat planes are repainted. The world uses a 3×
  PNG over the same logical bench and falls back to that sprite while the
  texture loads; the reward preview and hit test still use the logical art.
  The cloth retains its
  inset and island color assignments. The sunflower's three masks and breeze
  are unchanged; the other flowers retain their existing art.
- A material-only pass on the south-facing shore under the picnic island
  breaks up the pale spray and introduces cooler wet stone under the ledges.
  The terrain, spray mask, travel approach and moorings are unchanged.
