import type { PixelArt } from "./types.ts";

// Experiment: tiered rewards bought with a shared currency.
// See docs/experiments/rewards-currency.md for the reasoning behind the numbers.

export const currency = {
  id: "acorn",
  singular: "acorn",
  plural: "acorns",
} as const;

export const acornLabel = (amount: number) =>
  `${amount} ${Math.abs(amount) === 1 ? currency.singular : currency.plural}`;

export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export interface RarityTier {
  id: Rarity;
  name: string;
  price: number;
  // How many a single home base may own at once. Null means unlimited.
  limitPerHomebase: number | null;
  // Accent used for the tier badge in the pixel-world palette.
  color: string;
}

export const rarityTiers: Record<Rarity, RarityTier> = {
  common: {
    id: "common",
    name: "Common",
    price: 10,
    limitPerHomebase: null,
    color: "#5b8748",
  },
  uncommon: {
    id: "uncommon",
    name: "Uncommon",
    price: 25,
    limitPerHomebase: null,
    color: "#427682",
  },
  rare: {
    id: "rare",
    name: "Rare",
    price: 50,
    limitPerHomebase: null,
    color: "#8c4256",
  },
  legendary: {
    id: "legendary",
    name: "Legendary",
    price: 120,
    limitPerHomebase: 1,
    color: "#a27a14",
  },
};

export const rarityOrder: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "legendary",
];

// Every catalog item belongs to exactly one tier. Items missing here are not for sale.
export const itemRarity: Record<string, Rarity> = {
  sunflower: "common",
  "pink-tulip": "common",
  "oak-tree": "uncommon",
  "pine-tree": "uncommon",
  "rose-pennant": "rare",
  "blue-banner": "rare",
  "owl-statue": "legendary",
  "star-statue": "legendary",
};

export interface ShopListing {
  itemId: string;
  rarity: Rarity;
  price: number;
  limitPerHomebase: number | null;
}

export function shopListing(itemId: string): ShopListing | null {
  const rarity = itemRarity[itemId];
  if (!rarity) return null;
  const tier = rarityTiers[rarity];
  return {
    itemId,
    rarity,
    price: tier.price,
    limitPerHomebase: tier.limitPerHomebase,
  };
}

export const shopListings: ShopListing[] = Object.keys(itemRarity)
  .map((itemId) => shopListing(itemId)!)
  .sort(
    (a, b) =>
      rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity) ||
      a.itemId.localeCompare(b.itemId),
  );

// Earning rules: the concept brief's provisional formula,
// `20 × average + 80 × min`, scaled to 10 acorns per participant. On a single
// milestone that becomes 2 acorns for each person who checks in, plus 8 per
// person once the whole roster has checked in.
export const earning = {
  checkIn: 2,
  togetherPerPerson: 8,
} as const;

// A 12 × 12 acorn, lit from the upper left like the catalog sprites.
export const acornArt: PixelArt = {
  format: "pixel-art",
  palette: {
    a: "#3a2820",
    b: "#7c573a",
    c: "#a27a4e",
    d: "#c8a06c",
    e: "#5a3d2c",
    f: "#b8762f",
    g: "#d9973f",
    h: "#f0c070",
    i: "#8a5424",
  },
  pixels: [
    ".....aa.....",
    "......a.....",
    "...aaaaaa...",
    "..adddccba..",
    ".adccccbbea.",
    ".aeeeeeeeea.",
    "..aghgffia..",
    "..ahgfffia..",
    "..agffffia..",
    "...afffia...",
    "....aiia....",
    ".....aa.....",
  ],
};
