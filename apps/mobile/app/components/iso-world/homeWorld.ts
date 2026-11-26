import { checkMeadowPlacement, meadowPlacements, type MeadowPoint } from "@beside/api-client/garden"

import { CELL, screenToIso, type MapFrame } from "./projection"

/** The picnic blanket where friends gather. */
export const homeFocus = { u: 8.6, v: 9.3 }

/**
 * In the iso view an oak or reward goes in the middle of a tile. Tile centres are on PR #14's 8-pixel
 * meadow grid, so the API's shared placement rule decides, exactly as for the flat meadow.
 */
export function tileCentre(col: number, row: number) {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 }
}

export function plantingTap(
  frame: MapFrame,
  x: number,
  y: number,
  occupied: readonly MeadowPoint[] = [],
) {
  const { u, v } = screenToIso(frame, x, y)
  const col = Math.floor(u)
  const row = Math.floor(v)
  const point = tileCentre(col, row)
  const rejection = checkMeadowPlacement(point, occupied)
  return { col, row, point, rejection }
}

/** Tile centres accepted by the same oak/reward rule the API enforces. */
export function plantableTiles(occupied: readonly MeadowPoint[] = []) {
  return meadowPlacements(occupied)
    .filter(({ x, y }) => x % CELL === CELL / 2 && y % CELL === CELL / 2)
    .map(({ x, y }) => ({ col: (x - CELL / 2) / CELL, row: (y - CELL / 2) / CELL }))
}

/** Cycle through the guide, nearest to the friends first, for a gesture-free path. */
export function nextSuggestion(
  points: readonly MeadowPoint[],
  center: MeadowPoint,
  current?: MeadowPoint,
) {
  const sorted = [...points].sort(
    (a, b) =>
      Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y),
  )
  const index = sorted.findIndex((point) => point.x === current?.x && point.y === current.y)
  return sorted[(index + 1) % sorted.length]
}

export const rewardKey = (rewardId: string) => `reward-${rewardId}`
