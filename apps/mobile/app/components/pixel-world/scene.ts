import { initialMeadowItems, snapMeadowPoint } from "@beside/api-client/garden"
import { rewardItems, type PixelArt } from "@beside/rewards"

import { avatars, type Avatar } from "./avatars"
import { Ground, groundAt, type PicnicLayout } from "./terrain"

export { WORLD_HEIGHT, WORLD_WIDTH } from "./terrain"
export const catalogue = new Map(rewardItems.map((item) => [item.id, item]))

export interface WorldItem {
  key: string
  itemId: string
  // Bottom-center anchor, in world pixels. All catalogue sprites are 32 × 32.
  x: number
  y: number
}

export const initialItems: WorldItem[] = initialMeadowItems

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

export function avatarAt(x: number, y: number, scale: number, roster: Avatar[] = avatars) {
  const padding = Math.max(0, (44 / scale - 16) / 2)
  return [...roster]
    .sort((a, b) => Math.abs(x - a.x) - Math.abs(x - b.x))
    .find((a) => Math.abs(x - a.x) <= 7 + padding / 2 && y >= a.y - 20 - padding && y <= a.y + 2)
}

export function placementAt(
  x: number,
  y: number,
  items: WorldItem[],
  roster: Avatar[] = avatars,
  picnic: PicnicLayout = "pair",
) {
  const position = snapMeadowPoint(x, y)
  // The whole base must rest on open lawn: not woods, path, water, shore, dock, or blanket.
  for (let dx = -8; dx <= 8; dx += 4)
    for (let dy = -4; dy <= 0; dy += 2)
      if (groundAt(position.x + dx, position.y - 3 + dy, picnic) !== Ground.Lawn) return null
  const occupied = [...items, ...roster].some(
    (item) => Math.abs(item.x - position.x) < 22 && Math.abs(item.y - position.y) < 18,
  )
  return occupied ? null : position
}

// Visible extent of a sprite, used to size its ground shadow and place the selection marker.
export function footprint(art: PixelArt) {
  const rows = art.pixels
  let top = rows.length
  let bottom = -1
  rows.forEach((row, y) => {
    if (/[^.]/.test(row)) {
      top = Math.min(top, y)
      bottom = y
    }
  })
  let left = rows[0].length
  let right = -1
  for (let y = Math.max(0, bottom - 2); y <= bottom; y++)
    [...rows[y]].forEach((c, x) => {
      if (c === ".") return
      left = Math.min(left, x)
      right = Math.max(right, x)
    })
  return { top, bottom, left, right }
}
