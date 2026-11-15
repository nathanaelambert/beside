# Experiment 2c: equal-value rewards

Branch `exp/rewards-equal-value`. One of three parallel takes on tiered rewards
(the others are a currency and precursor items). This is a concept experiment, not
a product decision.

## The idea

Every reward is worth the same: **one milestone earns one item**. There's no
currency, no prices and no rarities. The value comes from the group picking an
item that fits the moment: a tulip for each Wednesday run, a wishing star for
finishing a book together.

This fits the [principles](../product/principles.md): there's no generic currency
(4.1), the group agrees beforehand what counts (2.1), and success is collective
(2.2). The data model already worked this way. A milestone references a catalog
item, a saved roster must all complete it, and the reward is earned once. What was
missing was the experience: no client let you pick, see or place a reward.

## Weaknesses, and how light UX steers without a value system

| Risk                                                                      | Steer (none of these blocks a choice)                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Everyone picks the biggest, showiest thing.**                           | The **group** is the check, not a price. The person who picks proposes the item, the roster can **Agree** or **Suggest another**, and the card shows who agreed. A greedy pick is visible to friends before anyone commits.                                                                                                                              |
| **Small milestones get big rewards** (a daily check-in earning a statue). | Suggestions follow the **shape of the milestone**: repeating milestones suggest _collections_ (flowers, trees), and one-off moments suggest _landmarks and markers_. A **"Worth a thought" mirror** says what the choice will look like, for example "This repeats 12 times, so that's 12 × Watchful owl". It describes the outcome and charges nothing. |
| **Big moments get small rewards.**                                        | The mirror also covers this case: "A single Sunflower is a quiet keepsake… if this one is big, a landmark will stand out more."                                                                                                                                                                                                                          |
| **Inflation: the meadow fills with junk.**                                | The meadow is the natural limit. Every reward must be **placed on free lawn** using the same rules as the starter oak. The picker shows how many of each item the meadow already holds ("2 in meadow"), so repeats read as a deliberate collection.                                                                                                      |
| **Rewards feel interchangeable.**                                         | Every placed reward **remembers what earned it**. Tap it to see the milestone, activity, date and people. The meaning of a reward comes from that history, not from what kind of item it is.                                                                                                                                                             |
| **Agreement becomes a chore.**                                            | Agreement is a signal, not a gate. Picking an item counts as agreeing to it. The reward locks at the first check-in, whoever has agreed by then (the API already fixed items after the first log).                                                                                                                                                       |

Category roles (`collection`, `marker`, `landmark`) live in
`@beside/rewards/guidance`. They describe what kind of moment an item suits; they
are not prices.

## The flow

1. **Choose.** Creating an activity now has a third step, _Choose a reward_. The
   catalog is grouped by category, each with a line on what it suits, and the
   suggested categories come first. The step shows the reward's roster ("Lands in
   your meadow when Mosaab, Nathanael, Vaibhav and Pritesh all check in").
2. **Agree.** Each milestone card shows the pending reward: who has agreed,
   **Agree**, and **Suggest another**. After the first check-in it shows
   "_n_ of 4 checked in". Upcoming occurrences show a compact chip. Tap one to give
   a single occurrence a different reward, for example to make the last session
   special.
3. **Earn.** The last check-in shows a landing card ("Everyone made it — the Blue
   swallowtail is yours") with **Place it in the meadow**. If the window closes
   first, the card says the reward wasn't earned this time.
4. **Place.** In the home base, earned rewards wait by the path until a member
   places them using the starter oak's preview-and-confirm flow. A suggested spot
   is pre-selected, and marked spots show free lawn. Members can tap a placed
   reward to see what it remembers, and move it later.

## How this relates to PR #14 (starter oak)

PR #14 is merged into `main`, and this branch is built on it. A reward is placed
exactly like the oak: marked spots, a preview in corner brackets, **Suggest spot**,
and the same planting pulse and framing. Both use one shared rule,
`checkMeadowPlacement(point, occupied)` in `packages/domain/src/garden.ts`, so a
reward can't stand on the oak and the oak can't stand on a reward. The starter oak
keeps PR #14's own table and API; earned rewards are stored next to it, outside the
domain snapshot, so the playground model is unchanged.

Migration **008** adds `reward_agreement` (per person, per item) and
`reward_placement` (grid coordinates). It's numbered after the other two reward
experiments (006 currency, 007 precursors) so the three can be applied side by
side.

The home base shows only PR #14's wild trees as scenery: in this model every
decoration you see was earned and remembers why. The other scenery spots stay
reserved by the shared rule.

## API additions

- `GET /homebases/:id/garden` now also returns `rewards` (placed rewards).
- `PUT /homebases/:id/garden/rewards/:rewardId` places or moves an earned reward
  (409 before it's earned).
- `GET /homebases/:id/reward-agreements` and `PUT /rewards/:rewardId/agreement`.
- Picking or changing an item through any path (milestone create or update, a
  schedule, or cron-generated occurrences) records the actor's or series creator's
  agreement.
- Migration 008 also seeds four catalog items: cherry blossom, lavender, reading
  bench and garden lantern.

## Open questions

- Should agreement ever gate a reward? For example, the reward only lands if
  everyone agreed. That's closer to principle 2.1, but adds friction.
- Changing a recurring series' default reward. Today you change one occurrence at
  a time, or stop the series and recreate it.
- Is the meadow's space limit enough? A bigger catalog (houses, bridges) would make
  the space limit matter more.
