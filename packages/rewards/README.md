# Reward catalog

`@beside/rewards` is the shared, framework-independent catalog for mobile and
playground. It exports `rewardItems`, `RewardItem`, and `PixelArt`. The
`@beside/rewards/pixel-art` entry exports the playground's SVG path helper.

Each item has a stable ID, name, category, and artifact. Artifacts store a hex-color
palette and rectangular pixel rows. A dot is transparent; other characters select
palette entries. The catalog holds the eight original 32 × 32 sprites plus five
precursor items (a Christmas tree and four cottage stages).

`recipes.ts` exports `rewardRecipes`, the code-owned precursor rules: an item
with a recipe upgrades one existing garden object in place (a Christmas tree on
a Meadow oak, each cottage stage on the one below). `buildPlans` groups
multi-stage builds. See [the experiment note](../../docs/experiments/rewards-precursors.md).
Category names are independent of activity categories.

The package exports TypeScript source directly to Metro, Next.js, and Node's
type-stripping test runner. It has no runtime dependencies or build step.
Consumers should clone seed data before mutating it. The playground validates
imports at its database boundary. The playground now implements milestone reward grants and home-base ownership
separately from these reusable item definitions. Saved world placements remain future work.
