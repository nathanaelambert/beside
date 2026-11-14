# Experiment 2b: tiered rewards through precursors

Branch `exp/rewards-precursors`. One of three parallel takes on tiered rewards
(currency, precursors, equal value). This one makes some rewards worth more by
making them **need something you already earned**.

## The idea in one paragraph

Some rewards build on an item already in the home base's garden. A **Christmas
tree** decorates an existing **Meadow oak** in place. A **cottage** goes up in
four stages (foundation → walls → roof → cosy cottage), each stage building on
the one below on the same plot. A reward with no precursor in the garden is
**locked**, and the app says exactly what it needs. Earning the precursor
through a milestone unlocks the next step, and you watch the object change in
the world.

## Data model

| Piece         | Where                                           | Shape                                                                                                                                                                  |
| ------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recipe table  | `packages/rewards/src/recipes.ts` (code)        | `rewardRecipes[itemId] = { upgrades: precursorItemId, verb }`. Items without a recipe are plain placeable rewards. `buildPlans` groups the cottage stages for display. |
| Sprites       | `packages/rewards/src/precursor-art.ts`         | Five 32 × 32 items in the existing pixel-art format: `christmas-tree` (the oak's exact rows, decorated) and four `cottage*` stages sharing one footprint.              |
| Garden object | `garden_object` table, `Database.gardenObjects` | `{ id, homebaseId, itemId, x, y, createdAt, updatedAt }`. One thing standing in a garden at its **current** stage.                                                     |
| Reward link   | `reward.garden_object_id`                       | Which object a reward placed or upgraded. Null until obtained, and while an obtained upgrade **waits** for its precursor.                                              |

Why a recipe table and not a general dependency graph: every rule so far is
"this item is built on that one". One precursor per item gives a chain (cottage)
or a single step (Christmas tree), and both kinds use the same code. Any-of
("a Christmas tree on an oak _or_ a pine") and all-of ("a bench needs wood
_and_ nails") are easy to add to the recipe shape later, but nothing needed
them yet. Recipes are code-owned, so the app and the API never disagree. The
sprites stay in the `reward_item` table as before.

Why an object table and not just "the latest reward": an upgrade has to
**transform something**. Giving the oak an identity (id + plot) lets the
Christmas tree replace it in place, lets the cottage keep its plot through four
stages, and gives each object a history (`gardenHistory`: "Was a Meadow oak").
It is also the first persisted world placement in the repo, which other
experiments can reuse.

## Rules

- **Per home base, not per participant.** Rewards were already home-base owned
  with a cooperative roster. Precursors follow: anyone's earned oak counts for
  the base, and everyone in the roster has to check in to earn the upgrade.
- **Planning gate (locks).** You can attach an upgrade to a milestone only if a
  matching precursor is _free_ in the base. Free means
  `objects at that stage + planned/waiting rewards of that stage − pending
upgrades that already claim one`. So one oak supports one Christmas tree, and
  a planned (not yet earned) foundation already lets you plan walls on it. That
  is the "queued" state, so a group can plan a whole cottage up front. A
  closed, unearned milestone stops reserving anything. Without a free
  precursor, the API rejects the plan with "Cottage roof needs Cottage walls in
  your garden first…", and the app shows the reward greyed out with a padlock.
- **Earning applies in order.** When a reward is obtained, `settleGarden` runs
  in the same transaction. A plain item takes the next free plot. An upgrade
  takes the oldest object at its precursor stage and changes its `itemId` in
  place. An upgrade earned before its precursor exists (walls before the
  foundation) is obtained but **waits**, then lands automatically once the
  precursor appears. Events: `garden.placed`, `garden.upgraded`,
  `garden.waiting`.
- **Placement.** Earned objects go on 12 fixed lawn plots (`gardenPlots`,
  nearest the picnic first, on the 8 px grid). A mobile test checks each plot
  against the terrain art, the scenery and the picnic. Upgrades never move.
  Free placement by members is out of scope here; PR #14 does that (see below).
- **Schedules.** An upgrade consumes one specific precursor, so it can only be
  the reward of a one-off milestone (`count: 1`). Recurring schedules may carry
  plain items. If a recurring occurrence would be locked at generation time, it
  is still planned, without the reward, so the cron job never fails.
- **Deleting a milestone** removes its reward record but keeps what already
  stands in the garden. Deleting a base removes its garden.
- **Existing data.** Migration 007 adds the table and column. `db:migrate` then
  syncs the code-owned catalog (new sprites) and plants rewards obtained before
  the garden existed, once.

## API

- `GET /api/v1/state` and `GET /api/v1/garden` include `gardenObjects`.
- `GET /api/v1/homebases/{id}/rewards` returns every catalog item's status in
  that base (`place`, `ready` with its target object, `queued`, or `locked`
  with the precursor chain) and counts (in garden, planned, waiting), plus
  build progress (`reached` of `stages`).
- `POST /milestones`, `PATCH /milestones/{id}` and `POST …/schedules` enforce
  the planning gate.

## App

- **Home base:** earned objects stand on their plots. The newest change this
  device has not seen sparkles and is selected ("New in your garden · Was a
  Meadow oak"). Tap any garden object for its story. A **Rewards** button opens…
- **Garden rewards:** the cottage build track (✓ built / next / 🔒), the
  Christmas-tree upgrade, and every reward with what it needs.
- **Planning a milestone:** a reward picker. Locked rewards stay visible but
  can't be chosen. Choosing an upgrade makes the milestone one-off.
- **Activity detail:** each milestone shows its reward and "1 of 2 checked
  in", then "✓ Christmas tree earned · your Meadow oak was upgraded". "Plan a
  milestone" adds another milestone to the same activity.

## PR #14 (starter oak)

PR #14 is not merged. I **designed for a clean merge** rather than building on
it:

- Migration numbers start at **007**, after #14's 005/006, so they apply in
  either merge order.
- No shared file names: my domain module is `precursors.ts` (not
  `garden.ts`), the client entry is `@beside/api-client/precursors` (not
  `/garden`), and the endpoint is `/homebases/{id}/rewards` (not `/garden`).
  Expect ordinary textual conflicts in `HomeBaseScreen.tsx`, `controllers.ts`,
  `api.ts`, `api-client/index.ts`, `migrations.ts` and `migrations.test.ts`.
- The starter oak uses item `oak-tree`, the Christmas tree's precursor. To
  connect them after both merge, make #14's plant endpoint also insert a
  `garden_object` (or move #14's table into it). The starter oak then becomes
  decoratable with no rule changes. #14's shared terrain rules
  (`checkStarterOakPlacement`) can replace the fixed plot list when members
  get to choose spots.
- Both use the same coordinate convention (bottom-centre anchor, 8 px grid).

## Known gaps and open questions

- One precursor per item; no any-of/all-of recipes, and no item consumed
  without being transformed.
- Placement is automatic. Members can't choose or move a spot yet (see #14).
  When all 12 plots are full, objects are stored without a position and are
  not drawn.
- An upgrade picks the oldest matching object. There's no "decorate _this_
  oak" choice yet.
- Should a deleted milestone also remove the stage it built? This experiment
  says no (objects are base property).
- Value vs. effort: a cottage costs four cooperative milestones, a Christmas
  tree two. Whether that "feels" tiered is the question for the team. This
  combines naturally with the currency experiment (stages with prices) or the
  equal-value one (every stage costs one milestone, as here).
- The local playground's browser model gets the same rules through
  `@beside/domain`, but it has no UI for the garden.
