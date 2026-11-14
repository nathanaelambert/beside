# Experiment 2a: tiered rewards through a currency

Branch `exp/rewards-currency`. This is one of three parallel takes on tiered
rewards: a currency (this one), precursor items, and equal-value rewards. It is
an experiment to compare, not a product decision.

## The idea in one paragraph

Showing up earns **acorns** for the home base. Each catalog item has a price set
by its rarity tier. Anyone in the home base can spend the shared acorns to buy an
item and plant it in the meadow, or return it for a full refund. Milestones no
longer need a reward chosen in advance. The group decides what to save for.

## Decisions and why

### Who holds the currency: the home base, with credit to each person

There is **one shared pool per home base**. The [concept brief](../product/concept-brief.md)
already points this way: "Credit accumulates in a connection-owned pool. Either
participant can buy and place decorations." Personal wallets would turn a shared
garden into side-by-side shopping and invite "I paid for that tree"
bookkeeping. The pool still records who caused each change: every ledger row
names the person whose check-in, purchase or return produced it. The shop's
history shows "Vaibhav checked in · Chapter 3 +2", so individual effort stays
visible without being spent separately.

### What it's called and looks like: acorns

Acorns fit the meadow: small, collectable, and they grow into the oaks you can
buy. The icon is a 12 × 12 pixel sprite in the catalog's palette and lighting
(`acornArt` in `packages/rewards/src/shop.ts`), drawn by the same renderer as
the decorations.

### How much a milestone earns: 2 each, plus 8 each when everyone makes it

The brief's provisional formula is `shared credit = 20 × average + 80 × min`.
Applied to one milestone with a scale of 10 acorns per person:

- **+2 acorns** for each successful check-in on an achievement milestone, credited
  to the person who checked in.
- **+8 acorns per roster member** once everyone on the roster has checked in. The
  bonus is paid once and credited to whoever completed it.

For two people that gives 2 if one shows up and 20 if both do, the brief's
10 : 100 ratio. For the four-person demo base, a full turnout pays 40. Solo
progress still earns something, but most acorns come from showing up together.

Other rules:

- **Roster**: participants still in the activity who had joined it when the
  milestone was planned. Someone who joins later earns their own 2 but is not
  required for the bonus. Someone who leaves stops blocking it. This differs
  from the cooperative item rewards, whose rosters are frozen, because acorns are
  ongoing income: one departed friend should not stall every future bonus.
- **Nothing for** milestone zero (joining), failed attempts or missed windows.
  There is no penalty either.
- **Retries never pay twice.** Earning happens in the same transaction as the
  log, and duplicate keys return the original result.
- **Deleting a milestone keeps the acorns it earned.** The ledger row keeps a note
  ("Chapter 3"), and its milestone link becomes null. Deleting the home base
  deletes its pool.

### Price tiers and rarity

| Tier      | Price | Items                          | Limit          | For a full 4-person turnout |
| --------- | ----: | ------------------------------ | -------------- | --------------------------- |
| Common    |    10 | Sunflower, Blush tulip         | none           | a quarter of one milestone  |
| Uncommon  |    25 | Meadow oak, Alpine pine        | none           | under one milestone         |
| Rare      |    50 | Rose pennant, Blue swallowtail | none           | about 1¼ milestones         |
| Legendary |   120 | Watchful owl, Wishing star     | one per meadow | 3 milestones                |

For a pair, double the counts: a legendary item takes 6 full sessions together.
Rarity means more than price. Legendary items are **one per home base**, so
they read as trophies rather than stock. Flowers stay cheap so a forest or
flower bed is reachable, as the brief's "choosing a tree repeatedly can
eventually create a forest" suggests. The tiers live in one shared module, so
the server enforces exactly what the app shows.

### What happens when you can't afford something

- The shop lists **every item**. Unaffordable cards are dimmed and show "8 more"
  with a progress bar toward the price.
- Selecting one explains the gap in session terms ("You need 8 more acorns. One
  milestone where everyone shows up earns 40.") and offers **Earn acorns**,
  which opens the activities.
- The server **rejects the purchase without charging**: "Not enough acorns: this
  costs 50 and your home base has 42." There is no debt, partial payment or
  saving up per item. Concurrent buyers are serialized, so two members cannot
  both spend the last acorns.
- Legendary items the base already owns show "Owned · Already in your meadow".

### Buying, placing and returning

Buying and placing are one action: choose an item, tap open lawn, preview it,
then **Buy for 50 acorns**. A separate inventory step adds UI without adding
much to the experiment. Tapping a bought item shows its tier, who paid and the
price, plus **Return**, which removes it and refunds the full price. This
follows the brief's "unused decorations can be returned for a full refund",
applied to placed items too. Moving items is not built yet.

## How it fits the existing model

- **Ledger, not a balance column**: `acorn_entry` rows (`check-in`, `together`,
  `purchase`, `refund`), with the balance as their sum. History, attribution
  and audits come for free. The validator rejects a negative balance, a second
  check-in payment per person and milestone, and a second bonus per milestone.
  The SQL migration enforces the same uniqueness with partial indexes.
- **Decorations**: `homebase_decoration` holds a placed purchase (item, price
  paid, buyer, x/y on the 8 px meadow grid, retry key). It sits beside the
  existing `reward` table, which still means "earned once by completing a
  milestone".
- **Milestone item rewards still work.** Choosing an item for a milestone still
  grants it on cooperative completion. In this experiment, a milestone with an
  item reward pays acorns too. If the team adopts currency, those per-milestone
  item rewards could be retired or kept for keepsakes.
- **Commands**: `buyDecoration` and `returnDecoration` run through the shared
  domain engine like every other command, so the playground could use them
  without API changes.
- **API**: `GET /api/v1/shop` returns tiers, prices and earning rules.
  `POST /api/v1/decorations` buys and places an item with an optional
  `externalKey` for safe retries. `DELETE /api/v1/decorations/{id}` returns it.
  `GET /state` now includes `acornEntries` and `decorations`, filtered to the
  caller's home bases.
- **Migration 007** (`007_acorns.sql`). It is numbered after PR #14's 005/006 so
  the two branches can merge in either order. Its only overlap is the
  `latestMigration` constant.

## PR #14 (starter oak) and what I chose

PR #14 is not merged, so this branch is built on `main` without it.

- **The starter oak stays free.** It is the onboarding gift that teaches
  placement before a group has earned anything. The **Meadow oak is sold in the
  shop** as an uncommon item (25 acorns). New bases start at 0 acorns, so the
  free oak covers the first-session moment that a starting grant would
  otherwise cover.
- **Placement rules.** The app checks terrain, scenery, friends and the picnic
  blanket with its existing `placementAt`. The API currently checks only meadow
  bounds, the 8 px grid and spacing from other purchases, because terrain is
  still app-only on `main`. Once #14 lands, `placementRejection` in
  `packages/domain/src/acorns.ts` should call its shared
  `checkStarterOakPlacement`-style rule. That would also let the starter oak
  become a `homebase_decoration` with `price = 0`, folding the
  `homebase_starter_oak` table into one model of what stands in the meadow.

## Showcase

1. Run the API against a disposable database and seed the demo:
   `API_URL=http://localhost:3093 node --experimental-strip-types apps/api/scripts/seed-acorns-demo.ts`.
   It creates "Project Beside" with four members and some earned and spent
   acorns (balance 42), plus tonight's Chapter 3, open, with everyone but
   Mosaab checked in.
2. Sign in as `mosaab@demo.beside.test` / `beside-demo-password`.
3. Home base shows **42** acorns and the sunflower Nathanael bought.
4. **Shop**: commons and uncommons are affordable. Rare items show "8 more" and
   legendary items show "One per meadow". Tap **Rose pennant**: "You need 8 more
   acorns…" with **Earn acorns**.
5. **Earn acorns → Read together**: Chapter 3 shows "+2 for each check-in" and
   "+32 when all 4 make it · 3 of 4 in". Tap **I was there**: "Everyone made
   it! +32 bonus acorns" and "+2 acorns".
6. **Spend them in the shop**: the balance is 76, and the pennant is now
   affordable. **Choose a spot**, tap open lawn left of the path, then **Buy for
   50 acorns**. The pennant stands in the meadow and 26 acorns remain.
7. Tap the pennant: "Rare · Mosaab paid 50", with **Return**. The shop's history
   lists every acorn, including the together bonus and the purchase.

## Known gaps

- Server placement does not check terrain until PR #14's shared terrain lands
  (see above).
- Bought items cannot be moved yet. Return and rebuy instead.
- Farming acorns by creating many open milestones is possible. The brief already
  lists "avoiding rewards for merely splitting one session into many logs" as
  open. A daily cap per activity would be the simplest guard.
- Prices and earning rules live in code (`packages/rewards/src/shop.ts`), not
  in the database. Changing the economy needs a deploy, which suits an
  experiment.
- No live push: other members see new acorns when they open or refresh, like the
  rest of the app.
- The playground does not show acorns, though its shared engine supports them.
