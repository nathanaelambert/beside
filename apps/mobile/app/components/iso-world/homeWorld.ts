import type { ApiState } from "@beside/api-client"

import { attendanceMilestones } from "@/services/api/attendance"

import { CELL, screenToIso, type MapFrame } from "./projection"
import type { HomeActivity } from "./scene"
import { starterOakGuidePoints, starterOakTap } from "../pixel-world/starterOak"

/** The picnic blanket and the cottages beside it. */
export const homeFocus = { u: 8.6, v: 9.3 }

/** Activities of one home base, oldest first, so each keeps its cottage as new ones arrive. */
export function homeActivities(state: ApiState, homebaseId: string, now: number): HomeActivity[] {
  return state.activities
    .filter((activity) => activity.connectionId === homebaseId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((activity) => ({
      id: activity.id,
      name: activity.name,
      open: attendanceMilestones(state.milestones, activity.id, now).open.length > 0,
    }))
}

/** Decorations this home base has earned together, oldest first. */
export function homeRewards(state: ApiState, homebaseId: string) {
  return state.rewards
    .filter((reward) => reward.homebaseId === homebaseId && reward.obtainedAt)
    .sort((a, b) => (a.obtainedAt ?? "").localeCompare(b.obtainedAt ?? ""))
    .map((reward) => ({ id: reward.id, itemId: reward.itemId }))
}

/**
 * In the iso view the oak goes in the middle of a tile. Tile centres are on PR #14's 8-pixel
 * meadow grid, so the API's shared placement rule decides, exactly as for the flat meadow.
 */
export function tileCentre(col: number, row: number) {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 }
}

export function plantingTap(frame: MapFrame, x: number, y: number) {
  const { u, v } = screenToIso(frame, x, y)
  const col = Math.floor(u)
  const row = Math.floor(v)
  const point = tileCentre(col, row)
  const { rejection } = starterOakTap(point.x, point.y)
  return { col, row, point, rejection }
}

let guide: { col: number; row: number }[] | undefined
/** Every tile whose centre accepts the starter oak. */
export function plantableTiles() {
  guide ??= starterOakGuidePoints()
    .filter(({ x, y }) => x % CELL === CELL / 2 && y % CELL === CELL / 2)
    .map(({ x, y }) => ({ col: (x - CELL / 2) / CELL, row: (y - CELL / 2) / CELL }))
  return guide
}
