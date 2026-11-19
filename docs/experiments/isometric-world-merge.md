# Isometric world + equal-value rewards merge

Branch: `merge/isometric-world`. Base: `origin/exp/rewards-equal-value`, followed
by a merge of `origin/main` and a preserved merge of `origin/exp/isometric-world`.
The isometric merge is `271152f`. Follow-up fixes and regression tests are separate.
A final fetch found upstream rewards commit `b7d5d6c` (keep near-miss rewards in
activity history). It was merged cleanly after the follow-up commit, preserving
the cottage plot and the new past-rewards behavior. Mobile type checks, tests and
the web export were repeated successfully after that merge.

## Conflict resolutions

- `apps/api/test/api.test.ts`: kept the garden response's `rewards` array and both
  equal-value reward tests. The older iso branch expected the oak-only response.
  The reward integration test now places and moves between island tile centres.
- `apps/mobile/app/screens/HomeBaseScreen.tsx`: retained the isometric island,
  pan/pinch/zoom/recenter camera, cottage selection and navigation. Integrated the
  reward branch's garden loading, placement target, preview/confirm panels,
  suggestions, waiting queue, memory (milestone, activity, date and people),
  movement and activity links. Both oak and reward taps and suggestions account
  for the saved oak and all saved rewards, excluding the reward being moved.
- `apps/mobile/app/screens/ActivityDetailScreen.tsx`: combined imports and styles;
  kept both the iso cottage plot and equal-value reward controls, picker,
  agreements/suggestions, earned list and landing card.

`ActivityCreateScreen` merged cleanly: both the cottage preview and reward-picker
step survive. Activities and login retain the iso branch's visuals.

## Coordinates, occupancy and migrations

The island is a projection of the existing 288 × 240 meadow, not a new storage
coordinate system. `meadowToIso(x, y)` is `(x / 16, y / 16)`. A new placement on
column `c`, row `r` sends `{ x: c * 16 + 8, y: r * 16 + 8 }`. These tile centres
are a subset of the existing 8-pixel grid accepted by the API and SQL constraints.
Existing saved 8-pixel positions retain their exact anchors, including positions
on tile edges. No positions are rounded, reinterpreted as tile indices or lost.

`checkMeadowPlacement(point, occupied)` in the domain remains the single persisted
placement rule. The mobile island's tap and suggestion helpers call it with the
same occupancy that `GardenService` checks. Regression tests check that all
suggested centres are rendered grass, accepted by the shared rule, and unavailable
when occupied by either kind of prop. Cottages remain on the iso branch's lots
outside plantable lawn. The API serializes writes through its existing advisory
transaction lock, so concurrent placements cannot bypass occupancy validation.

Historical pre-squash commit `77979d6` contained
`006_homebase_oak_coordinates.sql`, which converted the early `slot_id` oak table
to `(x, y)`. It is absent from the iso branch tip and main: main's squash already
creates `(x, y)` directly in `005_homebase_starter_oak.sql`. Restoring 006 would try
to add existing columns and migrate a nonexistent slot column. It was deliberately
not restored. Main's migrations 001–005 are unchanged; rewards' 008 is unchanged.
The unique, ordered list is 001, 002, 003, 004, 005, 008. The intentional gaps are
reserved by the independent currency/precursor reward experiments. No migration
or data conversion is needed for this projection.

## Removed paths and retained demos

- Removed `pixel-world/placement.ts`; its unused flat tap/guide path is gone.
  The small suggestion and reward-key helpers now live with island placement.
- Removed `homeRewards`, `REWARD_LOTS` and the iso scene's automatic eight-reward
  allocation. Earned rewards now wait in the home-base dock until confirmed, and
  all saved placements render as depth-sorted, tappable props at their saved
  coordinates. There is no eight-reward rendering cap.
- Removed the home base's flat canvas, flat framing/pulse state and flat hit-test
  path. It uses the iso ghost preview and tile marker; confirmation focuses the
  island camera on the saved prop.
- Kept the flat `WorldCanvas`, `starterOak` helpers and scene utilities that the
  separate `PixelWorldScreen` demo still uses. Kept shared placement panels.

A placement rejected because another member occupied its preview refreshes the
shared garden without closing the editor or hiding the reason for rejection.

## Verification (local, 2026-11-19)

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Exit 0; lockfile unchanged. Skia postinstall completed with missing-source-directory warnings while installing native artifacts. No native build was run. |
| `pnpm --filter @beside/domain check-types` | Exit 0. |
| `pnpm --filter @beside/api-client check-types` | Exit 0. |
| `pnpm --filter @beside/api check-types` | Exit 0. |
| `pnpm --filter playground check-types` | Exit 0; Next route type generation succeeded. |
| `pnpm --filter mobile check-types` | Exit 0. |
| `pnpm --filter playground lint` | Exit 0; no warnings. |
| `pnpm --filter mobile test --runInBand` | Exit 0; 18 suites, 118 tests passed, no snapshots. |
| `pnpm --filter @beside/api-client test` | Exit 0; 5 passed, 0 skipped. |
| `pnpm --filter playground test` | Exit 0; 52 passed, 0 skipped. |
| `createdb beside_iso_merge_20261119` | Exit 0; local PostgreSQL was available. |
| `DATABASE_URL=postgresql:///beside_iso_merge_20261119 TEST_DATABASE_URL=postgresql:///beside_iso_merge_20261119 pnpm --filter @beside/api db:migrate` | Exit 0; applied 001, 002, 003, 004, 005, 008 in order. |
| `DATABASE_URL=postgresql:///beside_iso_merge_20261119 TEST_DATABASE_URL=postgresql:///beside_iso_merge_20261119 pnpm --filter @beside/api test` | Exit 0; 24 tests, 3 suites passed, 0 skipped. |
| `pnpm --filter mobile exec expo export --platform web` | Exit 0; exported `apps/mobile/dist`, one web bundle. |
| ESLint on the edited mobile screens/helpers/tests with `--fix` | Exit 0 after formatting/import fixes. |
| `git diff --check` | Exit 0. |

Intermediate mobile checks exposed and corrected a missing disabled-control style,
obsolete flat-camera assertions, and invalid test-fixture enum values. An initial
`pnpm --filter mobile test -- --runInBand` exited 1 because the extra separator made
Jest treat `--runInBand` as a test pattern; the corrected command above ran the full
suite. The final regression tests cover waiting, preview, confirmation, memory,
movement, invalid terrain, shared occupancy, stale occupancy after a race, activity
links/cottages, old coordinate anchors and rendering more than eight rewards.

No native iOS/Android build or interactive simulator/browser test was performed.
Native Skia rendering and live pan/pinch gestures are therefore not visually
verified; the web bundle, scene/projection tests and mocked screen interactions
are verified. The throwaway PostgreSQL database is removed after verification.
