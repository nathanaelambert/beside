import { rewardItems } from "@beside/rewards"

export const WORLD_WIDTH = 288
export const WORLD_HEIGHT = 240
export const catalogue = new Map(rewardItems.map((item) => [item.id, item]))

export interface WorldItem {
  key: string
  itemId: string
  // Bottom-center anchor, in world pixels. All catalogue sprites are 32 × 32.
  x: number
  y: number
}

export const initialItems: WorldItem[] = [
  { key: "oak-west", itemId: "oak-tree", x: 66, y: 82 },
  { key: "oak-north", itemId: "oak-tree", x: 104, y: 62 },
  { key: "pine-north", itemId: "pine-tree", x: 177, y: 64 },
  { key: "pine-east", itemId: "pine-tree", x: 222, y: 91 },
  { key: "oak-east", itemId: "oak-tree", x: 250, y: 132 },
  { key: "pine-west", itemId: "pine-tree", x: 38, y: 138 },
  { key: "tulip-west", itemId: "pink-tulip", x: 80, y: 145 },
  { key: "sunflower-west", itemId: "sunflower", x: 68, y: 172 },
  { key: "owl", itemId: "owl-statue", x: 142, y: 107 },
  { key: "pennant", itemId: "rose-pennant", x: 114, y: 131 },
  { key: "star", itemId: "star-statue", x: 169, y: 177 },
  { key: "banner", itemId: "blue-banner", x: 216, y: 201 },
  { key: "oak-south", itemId: "oak-tree", x: 74, y: 222 },
  { key: "tulip-south", itemId: "pink-tulip", x: 137, y: 213 },
]

export function hitTest(items: WorldItem[], x: number, y: number, scale: number) {
  // At least a 44pt target, with the frontmost sprite winning overlapping hits.
  const padding = Math.max(0, (44 / scale - 32) / 2)
  return [...items]
    .sort((a, b) => b.y - a.y)
    .find(
      (item) =>
        Math.abs(x - item.x) <= 16 + padding && y >= item.y - 32 - padding && y <= item.y + padding,
    )
}

export function placementAt(x: number, y: number, items: WorldItem[]) {
  const position = { x: Math.round(x / 8) * 8, y: Math.round(y / 8) * 8 }
  // Keep the mock on the lawn, away from the pond and outer woodland.
  const onLawn = position.x >= 64 && position.x <= 224 && position.y >= 88 && position.y <= 216
  const onPond = position.x >= 184 && position.y >= 112 && position.y <= 176
  const occupied = items.some(
    (item) => Math.abs(item.x - position.x) < 24 && Math.abs(item.y - position.y) < 20,
  )
  return onLawn && !onPond && !occupied ? position : null
}
