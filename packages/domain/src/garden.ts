import {
  Ground,
  GROUP_BLANKET,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  groundAt,
} from "./meadow-terrain.ts";

export const starterOakItemId = "oak-tree";
export const meadowGridSize = 8;

export interface MeadowPoint {
  x: number;
  y: number;
}

export function snapMeadowPoint(x: number, y: number): MeadowPoint {
  return {
    x: Math.round(x / meadowGridSize) * meadowGridSize,
    y: Math.round(y / meadowGridSize) * meadowGridSize,
  };
}

export const initialMeadowItems = [
  { key: "oak-west", itemId: "oak-tree", x: 62, y: 86 },
  { key: "oak-north", itemId: "oak-tree", x: 100, y: 64 },
  { key: "pine-north", itemId: "pine-tree", x: 176, y: 66 },
  { key: "pine-east", itemId: "pine-tree", x: 220, y: 94 },
  { key: "oak-east", itemId: "oak-tree", x: 252, y: 108 },
  { key: "pine-west", itemId: "pine-tree", x: 44, y: 140 },
  { key: "tulip-west", itemId: "pink-tulip", x: 82, y: 146 },
  { key: "sunflower-west", itemId: "sunflower", x: 68, y: 174 },
  { key: "owl", itemId: "owl-statue", x: 142, y: 107 },
  { key: "pennant", itemId: "rose-pennant", x: 114, y: 132 },
  { key: "star", itemId: "star-statue", x: 180, y: 190 },
  { key: "banner", itemId: "blue-banner", x: 222, y: 204 },
  { key: "oak-south", itemId: "oak-tree", x: 82, y: 214 },
  { key: "tulip-south", itemId: "pink-tulip", x: 112, y: 202 },
];

/** Keep the shared gathering area clear regardless of the current avatar count. */
export function checkStarterOakPlacement({ x, y }: MeadowPoint) {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= WORLD_WIDTH ||
    y >= WORLD_HEIGHT ||
    x % meadowGridSize !== 0 ||
    y % meadowGridSize !== 0
  )
    return "off-grid";

  for (let dx = -8; dx <= 8; dx++)
    for (let dy = -7; dy <= -3; dy++)
      if (groundAt(x + dx, y + dy, "group") !== Ground.Lawn) return "terrain";

  // Extend the protected picnic area south to cover additional rows of friends.
  if (
    x >= GROUP_BLANKET.x0 - 12 &&
    x <= GROUP_BLANKET.x1 + 12 &&
    y >= GROUP_BLANKET.y0 - 4
  )
    return "occupied";
  if (
    initialMeadowItems.some(
      (item) => Math.abs(item.x - x) < 22 && Math.abs(item.y - y) < 18,
    )
  )
    return "occupied";

  return null;
}

export function starterOakPlacements(): MeadowPoint[] {
  const points: MeadowPoint[] = [];
  for (let y = 0; y < WORLD_HEIGHT; y += meadowGridSize)
    for (let x = 0; x < WORLD_WIDTH; x += meadowGridSize)
      if (!checkStarterOakPlacement({ x, y })) points.push({ x, y });
  return points;
}
