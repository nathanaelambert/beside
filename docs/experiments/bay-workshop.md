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
  restrained highlights, bark tones, and a common ground anchor. Sprouts
  and young trees use 32 × 32 logical cells. The taller mature sprites use
  larger frames without changing anchors, growth timings, or breeze.
- Sunflower, blush tulip, and lavender keep their own leaf and bloom shapes
  from sprout to full bloom, with the same palette and upper-left light as
  the garden trees. Their sprites in `apps/mobile/assets/images/flower-family`
  use one grounded 32 × 32 logical cell and the same texture in the garden
  preview, Home Base, and the garden's item details.
- Detailed grass uses warm olive tones and staggered blade clusters painted
  across tile seams. Forest-rim shrubs share the oak's upper-left lighting
  and clustered leaves; their ground contact, anchor, and breeze are kept.
  The ground still uses each island's established seasonal palette.
- Harbor wood uses honeyed boards, seams and pegs on the pond deck and
  procedural pier. The Terracotta and archipelago pier texture keeps its
  original mask and anchor, with a matching RGB finish. Garden lanterns
  echo the cottage's limestone and amber window light, without changing
  their placement, the ground contact, or the boat's mooring point.
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

### Shared pixel-art finish

- Use the mature oak and sunflower as references for grouped upper-left light
  and quieter material planes. All three Terracotta stages keep their 3×
  textures, exact alpha masks, front portal and steps. The roof, plaster and
  ivy group small highlights without changing the clay color or amber windows.
- The reading bench borrows the showcase chairs' honey-toned wood and clear
  separation between the seat top and front. Its detailed texture uses a compact,
  stepped backrest and an angled seat edge for depth without losing front-on
  readability. Only the visible upper texture is reshaped. The blue book,
  limestone supports, world shadow, position and logical hit mask are unchanged.
- The four detailed portraits use connected 2× highlight clusters in hair,
  frames and clothing instead of isolated points. Avatar identities, logical
  bounds, and idle, blink and breathing behavior are unchanged.
- Woodland, Plum, Moss and Clubhouse apply the same light grouping to all
  three stages without sharing a roof palette. Keep Woodland's teal roof and
  timber, Plum's purple tiles and pink flowers, Moss's olive shingles and aged
  stone, and the Clubhouse's slate roof, double door and loft pennant. The
  native textures retain the exact alpha masks and front steps; the island
  lots, taps and milestone thresholds still use the existing scene.
- The first measured texture pass groups roof seams on Moss and Clubhouse
  without flattening the roof planes, adds short grain on the reading bench,
  and adds small hair and cheek transitions to the Nathaniel and Vaibhav
  portraits. Compare the same Home Base material patches at the normal 2×
  and 3× zoom. Within-cell detail and between-cell contrast are separate
  measurements, not a quality score or a target that all materials must meet.

### Native detailed portraits

- The detailed island view uses native 48 × 60 portraits for Mosaab,
  Nathaniel, Vaibhav and Pritesh. The shaped shoulders and stepped warm
  highlights take cues from the showcase's One world illustration. Each keeps
  the original login portrait's key skin and clothing colors, including Vaibhav's
  rounded bald head and red plaid shirt. The original (non-detailed) portraits
  are unchanged.
- The drawable still occupies its original 16 × 20 logical rectangle with
  the same ground anchor. The idle, blink, and breathing poses use that same
  rectangle and the existing timing. In the breathing pose only the head
  settles two source texels; the shoes stay planted.

### Picnic and pond finish

- The main island uses a cropped 3× surface texture over the existing gingham
  and open pond water. The blanket keeps broad, flat checks with short paired
  threads in the island's own palette. Paired stitches stay inside the existing
  hem, with no additional grain over it. Tapered reflections leave the pond
  quieter than the characters.
- Only existing cloth pixels and the pond interior can receive accents. The
  blanket binding and footprint, near-bank water, sand, dock, coast foam and
  surrounding sea keep their existing pixels and geometry. The pond's
  animated glints still draw over the finish at the original positions.
- The quiet pond prototype replaces periodic strokes with two fixed reflection
  clusters and larger, darker color planes toward the basin. The new
  reflections do not animate; only the pre-existing glints retain motion.

### Cottage entry lighting and contact

- Moss keeps its olive roof, green door, doorstep and exact sprite alpha at
  every stage. Only the arch and steps receive a short warm light, with a
  darker stone return beside the door.
- A small pixel-snapped shadow sits beneath the existing step in both the
  island and activity plot. It is not part of the cottage's hit mask; the
  plot anchor and milestone navigation are unchanged.
- The approved Moss contact also registers Terracotta, Woodland, Plum and
  Clubhouse at their common front step, independent of their roof and annex
  widths. Their local portal tones follow the individual limestone or wood
  materials. The light on the step follows the existing 2:1 ground axis.
  No sprite is shifted or rescaled; growth, alpha and hits stay unchanged.

### Terracotta depth pilot

- All three Terracotta textures extend the visible stone base, side wall and
  eave toward the back-left along the 2:1 ground axis. The added depth is
  0.45 tile, rounded to 22 × 11 native texels at 3×.
- The front facade, doorway, step, sprite bounds, lot and logical hit mask
  stay fixed. The wing and loft share the same floor line: the loft adds
  height, not another extension into the lawn.
- At home, when neighboring Plum is on the back diagonal, draw only
  Terracotta's added rear pixels underneath Plum. The paired transparent PNGs
  reassemble the approved Terracotta texture without shared opaque pixels.
  Keep the facade, contact shadow and hit mask in their original pass. The
  activity view and an isolated Terracotta still use the full texture.

### Depth across cottage styles

- Woodland, Plum, Moss and Clubhouse use separate 3× rear textures in their
  starter, wing and loft stages. Each extends the same 2:1 ground axis as
  Terracotta while retaining its original front PNG, doorway and lot. The
  wing and loft share the same ground plane.
- The rear has no hit target or shadow. In the home scene it draws behind any
  earlier facade that intersects its projected bounds, rather than moving an
  entire house. The single-cottage activity and workshop keep the same base
  anchors and use the separate rears where available.

### Storybook plant scale

- The sunflower stays in its 32-pixel frame with shorter sprout, bud and
  bloom silhouettes. The oak keeps its 10-pixel sprout, grows to a 20-pixel
  young silhouette, and reaches 34 visible pixels in a 40-pixel mature frame.
- Planted and border oaks share the mature art. Native texture bounds and
  selection spans follow the silhouette, but the saved garden positions,
  foliage phase and lower stem or root pixels stay registered to the same
  ground anchor. The breeze continues to move only the upper bands.
- Alpine pine and cherry blossom retain their original sprouts. The young
  silhouettes reach 23 and 22 pixels respectively; mature pine is 38 pixels
  tall with a narrow 24-pixel outline, and mature cherry reaches 33 pixels
  with a rounder 35-pixel crown. The 44- and 40-pixel mature frames leave
  room for that growth above the same ground anchor.
- Blush tulip and lavender use the same 32-pixel frame and keep their
  original lower stems. The tulip opens into a compact cup at about 15
  visible pixels; lavender stays narrow with several spikes at 18 pixels.
  Both stay below the avatars and keep the original breeze and growth timing.

### Storybook prop scale

- Forest shrubs have slightly lower, narrower crowns and keep the same
  rooted edge and breeze. Land boulders lose two pixels of height above
  the original wide foot; sea rocks, foam, and coast geometry are unchanged.
- The garden lantern has a 15-pixel silhouette instead of 28. Its limestone
  roof, lit window, and mossy base remain readable at island scale. The
  frame, plinth, and placement stay put in Home Base and Bay Workshop.

### Storybook limestone paths

- Detailed paths use the round-three limestone swatch: longer cream faces,
  offset courses, occasional clipped corners and warmer joints. The stone
  pattern uses world coordinates so adjoining path cells do not show a seam.
- The exposed one-pixel rim blends with the existing weathered stone.
  Original art, path tiles and elevations, sand, water, grass and furniture
  are unchanged.

### Sheltered pond and limestone shore

- Home Base's native pond finish uses asymmetric green-teal light planes,
  two shallow submerged stone groups and short, broken reflections.
  Two small floating leaves are painted into that surface, not added as
  objects; they have no placement, hit target, or growth rule.
- The raised banks and outermost waterline stay untouched. On the existing
  picnic headland, short facets break up the dry limestone above its damp
  foot. Land shape, sand, sea texture, foam mask and glint positions are
  unchanged. The existing pond glints use a quieter green tint at the same
  timing and positions. No waterfall is added to the shallow pond.

### Quiet meadow and dry sand

- Home Base's lawn finish keeps the regional color ramp and woodland shading.
  It uses broader fields and fewer high-contrast tufts, grouped around
  transitions between the same grass tones.
- Dry pond sand uses a matte palette and short, broken drifts. The original
  damp edge, water, ground coverage, and course of the shoreline stay intact.
- The picnic blanket is unchanged: the lower-contrast weave trial did not
  improve readability at the island's normal zoom.

### Compact garden keepsakes

- Detailed catalog art uses the approved 17-pixel owl and star statues and
  the 19-pixel rose pennant and blue swallowtail. The owl retains its eyes
  and chest and the star its five points. Both banners keep their identities.
- All four keep their original 32-pixel registration, painted ground
  supports, item identities and saved positions. Original art and the
  harbor props are unchanged.

### Harbor material finish

- In Detailed art, honeyed wood accents affect only the jetty's dry deck
  boards and the rowboat's dry hull and gunwale. The lamp, rope, posts,
  oars, seat, painted stripes, and wake keep their previous colors.
- The buoy's body has quieter red and linen bands in both frames. Only the
  top edge of each sign gets a warmer highlight; lettering, nails, and the
  current-island pennant stay as they were.
- The original look, the pond deck, outlines, anchors, travel paths, and
  mooring points do not change.
