// Precursor rules ("recipes"). Artwork lives in the catalog and the database;
// these rules are code-owned so the app and the API can never disagree.
//
// One rule shape covers both showcase cases:
// - an upgrade on top of an existing item: a Christmas tree decorates an oak;
// - a multi-stage build: each cottage stage upgrades the previous stage.
// Earning an upgrade changes that garden object in place. It never lands on
// bare lawn, so a locked item is simply one with no precursor to build on.
export interface RewardRecipe {
  // The single item this one is built on. Any-of or all-of ingredients are
  // deliberately out of scope for this experiment.
  upgrades: string;
  // Short verb for the transformation, e.g. "Decorate" or "Raise".
  verb: string;
}

export const rewardRecipes: Readonly<Record<string, RewardRecipe>> = {
  "christmas-tree": { upgrades: "oak-tree", verb: "Decorate" },
  "cottage-walls": { upgrades: "cottage-foundation", verb: "Raise" },
  "cottage-roof": { upgrades: "cottage-walls", verb: "Roof" },
  cottage: { upgrades: "cottage-roof", verb: "Finish" },
};

// Display grouping for multi-stage builds. Stage one has no precursor.
export interface BuildPlan {
  id: string;
  name: string;
  stages: readonly string[];
}
export const buildPlans: readonly BuildPlan[] = [
  {
    id: "cottage",
    name: "Cottage",
    stages: ["cottage-foundation", "cottage-walls", "cottage-roof", "cottage"],
  },
];

export const precursorOf = (itemId: string): string | null =>
  rewardRecipes[itemId]?.upgrades ?? null;

// Every stage below an item, nearest first: cottage → roof → walls → foundation.
export function precursorChain(itemId: string): string[] {
  const chain: string[] = [];
  for (
    let next = precursorOf(itemId);
    next && !chain.includes(next);
    next = precursorOf(next)
  )
    chain.push(next);
  return chain;
}
