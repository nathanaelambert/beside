import type { MeadowPoint } from "@beside/api-client/garden"

import { coastHeight, coastRimV, coastStair } from "./coastAccess"
import { tileCentre } from "./homeWorld"
import { CELL, screenToIso, type MapFrame } from "./projection"
import { tileAt, type TileMap } from "./tilemap"

export type LawnCell = { col: number; row: number }
export type LawnWalk = { cell: LawnCell; route: MeadowPoint[]; lift?: number }

const neighbours = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const

const keyOf = ({ col, row }: LawnCell) => `${col}:${row}`
export const meadowCell = ({ x, y }: MeadowPoint): LawnCell => ({
  col: Math.floor(x / CELL),
  row: Math.floor(y / CELL),
})

const isStair = (cell: LawnCell) => cell.col === coastStair.col && cell.row === coastStair.row
const point = (u: number, v: number): MeadowPoint => ({ x: u * CELL, y: v * CELL })
const approach = { col: coastStair.col, row: coastStair.row - 1 }
const approachPoint = tileCentre(approach.col, approach.row)
const stairFoot = point(coastStair.walkingU, coastStair.back)
const stairLanding = point(coastStair.walkingU, coastRimV)

function meadowRoute(map: TileMap, start: MeadowPoint, cell: LawnCell, obstacles: Set<string>) {
  const origin = meadowCell(start)
  const originKey = keyOf(origin)
  const goalKey = keyOf(cell)
  if (obstacles.has(goalKey)) return undefined
  const queue = [origin]
  const parents = new Map<string, LawnCell | undefined>([[originKey, undefined]])
  for (let i = 0; i < queue.length && !parents.has(goalKey); i++) {
    const here = queue[i]!
    for (const [dc, dr] of neighbours) {
      const next = { col: here.col + dc, row: here.row + dr }
      const key = keyOf(next)
      if (obstacles.has(key) || parents.has(key) || (map.coastTiles?.length && isStair(next)))
        continue
      const kind = tileAt(map, next.col, next.row)?.kind
      if (kind !== "grass" && kind !== "path" && kind !== "blanket") continue
      parents.set(key, here)
      queue.push(next)
    }
  }
  if (!parents.has(goalKey)) return undefined
  const route: MeadowPoint[] = []
  for (let at: LawnCell | undefined = cell; at; at = parents.get(keyOf(at)))
    route.push(tileCentre(at.col, at.row))
  return [start, ...route.reverse()]
}

/** Connect the original lawn graph to the protected rim lane through the old limestone path. */
function coastRoute(map: TileMap, start: MeadowPoint, goal: LawnCell, obstacles: Set<string>) {
  const origin = meadowCell(start)
  const originU = start.x / CELL
  const originV = start.y / CELL
  const goalPoint = tileCentre(goal.col, goal.row)
  const onCoast = origin.row === map.rows
  const toCoast = goal.row === map.rows
  const onRim = origin.row === map.rows - 1 && originV >= coastRimV - 0.0001
  // A view may blur between two animation frames, including halfway up the stairs.
  const onStair =
    originU >= coastStair.left &&
    originU < coastStair.right &&
    originV >= coastStair.back &&
    originV <= coastRimV &&
    origin.col === coastStair.col
  if (onCoast && toCoast) {
    let connected = true
    for (let col = Math.min(origin.col, goal.col); col <= Math.max(origin.col, goal.col); col++)
      connected &&= !!tileAt(map, col, goal.row) && !obstacles.has(keyOf({ col, row: goal.row }))
    if (connected) return [start, goalPoint]
  }
  const fromMeadow = !onCoast && !onRim && !onStair
  const rimFrom = fromMeadow || (onStair && !onRim) ? coastStair.walkingU : originU
  const rimTo = toCoast ? goal.col + 0.5 : coastStair.walkingU
  for (
    let col = Math.floor(Math.min(rimFrom, rimTo));
    col <= Math.floor(Math.max(rimFrom, rimTo));
    col++
  )
    if (obstacles.has(keyOf({ col, row: map.rows - 1 }))) return undefined
  if ((fromMeadow || !toCoast) && [approach, coastStair].some((cell) => obstacles.has(keyOf(cell))))
    return undefined

  let route: MeadowPoint[]
  if (fromMeadow) {
    const path = meadowRoute(map, start, approach, obstacles)
    if (!path) return undefined
    route = [...path, stairFoot, stairLanding]
  } else if (onRim || onCoast) {
    route = [start, point(originU, coastRimV)]
  } else {
    route = toCoast ? [start, stairLanding] : [start]
  }
  if (toCoast) return [...route, point(rimTo, coastRimV), goalPoint]
  const path = meadowRoute(map, approachPoint, goal, obstacles)
  if (!path) return undefined
  return [...route, ...(onStair && !onRim ? [] : [stairLanding]), stairFoot, ...path]
}

/** Only the face of a saved raised tile can be picked, never the sea beneath it. */
function walkingDestination(map: TileMap, frame: MapFrame, tap: MeadowPoint) {
  const cellAt = (lift: number) => {
    const { u, v } = screenToIso(frame, tap.x, tap.y, lift)
    return { col: Math.floor(u), row: Math.floor(v) }
  }
  const coast = cellAt(coastHeight)
  if (map.coastTiles?.some((tile) => keyOf(tile) === keyOf(coast)))
    return { cell: coast, lift: coastHeight }
  const cell = cellAt(0)
  return cell.row < map.rows ? { cell } : undefined
}

/** BFS over the original lawn, with an exact ramp and rim corridor to confirmed headlands. */
export function lawnWalk(
  map: TileMap,
  frame: MapFrame,
  start: MeadowPoint,
  tap: MeadowPoint,
  blocked: readonly LawnCell[],
): LawnWalk | undefined {
  const destination = walkingDestination(map, frame, tap)
  if (!destination) return undefined
  const { cell } = destination
  const origin = meadowCell(start)
  const obstacles = new Set(blocked.map(keyOf))
  if (
    keyOf(origin) === keyOf(cell) ||
    tileAt(map, cell.col, cell.row)?.kind !== "grass" ||
    obstacles.has(keyOf(cell))
  )
    return undefined
  const needsCoast =
    map.coastTiles?.length && (isStair(origin) || origin.row >= map.rows - 1 || !!destination.lift)
  const route = needsCoast
    ? coastRoute(map, start, cell, obstacles)
    : meadowRoute(map, start, cell, obstacles)
  return route && { ...destination, route }
}
