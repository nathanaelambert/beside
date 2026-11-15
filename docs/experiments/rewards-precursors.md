# Experiment 2b: tiered rewards through precursors

Branch `exp/rewards-precursors`. One of three parallel takes on tiered rewards
(currency, precursors, equal value). This one makes some rewards worth more by
making them **need something you already earned**.

## The idea in one paragraph

Some rewards build on an item already in the home base's garden. A **Christmas
tree** decorates an existing **Meadow oak** in place, and you pick which oak
(the free starter oak from PR #14 counts). A **cottage** goes up in four stages
(foundation → walls → roof → cosy cottage), each stage building on the one
below on the same spot. A reward with nothing free to build on is **locked**,
and the app says exactly what it needs. Earning the precursor through a
milestone unlocks the next step, and you watch the object change in the world.
Earned items are placed by hand, and anything in the garden can be moved.

## Decisions from the team (2026-11-15)

- PR #14 (starter oak) has landed: this branch merges it and builds on it.
- Placement is manual, and moving is allowed.
- The planner picks the precursor an upgrade builds on.
- Different milestone counts per reward (2 for a Christmas tree, 4 for a
  cottage) are fine.

## Data model

| Piece         | Where                                          | Shape                                                                                                                                                                                       |
| ------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recipe table  | `packages/rewards/src/recipes.ts` (code)       | `rewardRecipes[itemId] = { upgrades: precursorItemId, verb }`. Items without a recipe are plain rewards. `buildPlans` groups the cottage stages for display.                                |
| Sprites       | `packages/rewards/src/precursor-art.ts`        | Five 32 × 32 items in the existing pixel-art format: `christmas-tree` (the oak's exact rows, decorated) and four `cottage*` stages sharing one footprint.                                   |
| Garden object | `garden_object`, `Database.gardenObjects`      | `{ id, homebaseId, itemId, origin, x, y, createdAt, updatedAt }`. One thing in a garden at its **current** stage. `origin` is `starter` (PR #14's oak) or `reward`. `x, y` null = unplaced. |
| Reward link   | `reward.garden_object_id`                      | The object a reward created or upgraded. Null until obtained, and while an obtained upgrade waits for its precursor.                                                                        |
| Chosen target | `reward.target_object_id` / `target_reward_id` | For an upgrade: the precursor it builds on, either a garden object or a planned reward that will become one. Exactly one, chosen at planning time.                                          |

Why a recipe table and not a general dependency graph: every rule so far is
"this item is built on that one". One precursor per item gives a chain (cottage)
or a single step (Christmas tree), and both kinds use the same code. Any-of and
all-of ingredients are easy to add to the recipe shape later; nothing needed
them yet. Recipes are code-owned, so the app and the API never disagree.

Why an object table and not one placement per reward (main's target schema
sketches `reward_placement`): an upgrade has to **transform something**. The oak
needs an identity so the Christmas tree can replace it in place; the cottage
keeps one spot through four stages; and each object has a history
(`gardenHistory`: "Was a Meadow oak", "foundation → walls → roof → cottage").
Several rewards point at one object, which a per-reward placement can't express.

## Rules

- **Per home base, not per participant.** Rewards were already home-base owned
  with a cooperative roster. Precursors follow: anyone's oak counts for the
  base, and everyone in the roster has to check in to earn the upgrade.
- **Pick the precursor.** Planning an upgrade (`POST /milestones`, `PATCH
/milestones/{id}` or a one-off schedule) takes `buildOnId`: a free object at
  the precursor stage, or a free planned reward of that stage. Omit it to use
  the oldest. The pick **reserves** that precursor, so one oak carries one
  Christmas tree. A planned foundation can already carry planned walls ("queued"),
  so a group can plan a whole cottage up front.
- **Locks.** With nothing free to build on, the reward is locked: the API
  rejects the plan with "Cottage roof needs Cottage walls in your garden
  first…", and the app shows it greyed out with a padlock. A closed, unearned
  milestone stops reserving anything.
- **Earning.** `settleGarden` runs in the check-in transaction. A plain item
  becomes a new, **unplaced** object. An upgrade changes its chosen object in
  place. An upgrade earned before its precursor exists (walls before the
  foundation) waits, then lands automatically once the precursor is earned.
  Events: `garden.earned`, `garden.upgraded`, `garden.waiting`.
- **Placing and moving.** Any member places an unplaced object, or moves any
  placed one (starter oak included), with `POST /garden/{objectId}/place`.
  Moving is free and keeps the object, its stage and history. The rule is
  PR #14's (open lawn, off the picnic, clear of the scenery, 8 px grid),
  extended to keep clear of every other garden object (`checkGardenPlacement`).
  The app's guide dots and tap checks use the same function. PR #14's
  starter-oak planting uses it too, so the oak can't land on a cottage.
- **Schedules.** An upgrade consumes one specific precursor, so it can only be
  the reward of a one-off milestone. Recurring schedules may carry plain items.
  If an occurrence can't be planned with its reward at generation time, it is
  still planned without it, so the cron job never fails.
- **Deleting.** Deleting a milestone removes its reward record but keeps what
  already stands in the garden. An upgrade planned on a deleted planned reward
  is detached and waits. Changing the item of a reward something builds on is
  refused. Deleting a base removes its garden.

## PR #14 (starter oak)

- **Merged** into this branch. Migration 005 is main's; this branch's is **007**.
  006 is left free because the currency experiment renumbered to 006.
- **The starter oak is a garden object** (`origin = 'starter'`). Migration 007
  copies `homebase_starter_oak` rows into `garden_object` at the same spot, then
  drops the old table. PR #14's endpoints keep their shape, so its screens and
  tests work unchanged. `GET /homebases/{id}/garden` reports the starter at its
  current stage, so `oak.itemId` can now be `christmas-tree`. This is the only
  contract change.
- PR #14's decoration panel now pages through the eight everyday decorations
  (`decorationItems`), not the precursor items.

## API

- `GET /api/v1/state` and `GET /api/v1/garden` include `gardenObjects`.
- `GET /api/v1/homebases/{id}/rewards` lists each item's status (`place`,
  `ready` or `queued` with the precursor **candidates** to pick from, or
  `locked` with the chain it needs), counts (in garden, planned, waiting), and
  build progress.
- `POST /api/v1/garden/{objectId}/place` places or moves an object.
- `buildOnId` on milestones and schedules picks the precursor.
- `db:migrate` also syncs the code-owned catalog (new sprites) and turns
  rewards earned before 007 into unplaced objects.

## App

- **Home base:** earned objects stand where members put them. An earned item
  shows "… is ready to place · Place it". Placing and moving use PR #14's look:
  marked spots, a closer camera, Suggest spot, a preview in corner brackets and
  the planting pulse. Tap anything in the garden for its story and **Move**.
  The newest change this device hasn't seen sparkles.
- **Rewards:** the cottage build track (✓ built / next / 🔒), the Christmas-tree
  upgrade, and every reward with what it needs.
- **Planning a milestone:** a reward picker. Locked rewards stay visible but
  can't be chosen. An upgrade shows **Builds on** with each free precursor
  ("Your starter oak", "Meadow oak from “Plant a second tree”", "The planned
  Cottage foundation from “Lay the foundation”") and is one-off.
- **Activity detail:** each milestone's reward, what it builds on and "1 of 2
  checked in"; then "✓ … earned" with **Place it in the garden**.

## Known gaps and open questions

- One precursor per item; no any-of/all-of recipes.
- Moving a precursor doesn't affect upgrades planned on it, which is
  intentional (they follow the object), but there's no undo for a move.
- An upgrade detached from a deleted planned precursor just waits; the app says
  so but doesn't offer to re-pick yet (editing the milestone does).
- The playground gets the rules through `@beside/domain` but has no garden view.
- The existing scheduling API test needs a fresh test database: its mocked
  year-2030 cron run counts expired windows left by other suites.
