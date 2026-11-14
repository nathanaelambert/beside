# Reward catalog

`@beside/rewards` is the shared, framework-independent catalog for mobile and
playground. It exports `rewardItems`, `RewardItem`, and `PixelArt`. The
`@beside/rewards/pixel-art` entry exports the playground's SVG path helper.

Each item has a stable ID, name, category, and artifact. Artifacts store a hex-color
palette and rectangular pixel rows. A dot is transparent; other characters select
palette entries. The eight original 32 × 32 sprites remain the only seeded items.
Category names are independent of activity categories.

The package exports TypeScript source directly to Metro, Next.js, and Node's
type-stripping test runner. It has no runtime dependencies or build step.
Consumers should clone seed data before mutating it. The playground validates
imports at its database boundary. The playground now implements milestone reward grants and home-base ownership
separately from these reusable item definitions. Saved world placements remain future work.

`@beside/rewards/shop` holds the rewards-currency experiment's economy:
the acorn currency and its sprite, the four rarity tiers with prices and
per-home-base limits, each item's tier, and the earning rules. The domain
engine, API and mobile app all read it, so prices cannot drift between them.
See [the design note](../../docs/experiments/rewards-currency.md).
