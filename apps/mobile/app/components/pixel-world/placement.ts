import {
  checkMeadowPlacement,
  Ground,
  groundAt,
  meadowPlacements,
  snapMeadowPoint,
  type MeadowPoint,
} from "@beside/api-client/garden"

/** Where a tap would put a decoration, using the same rules the API enforces. */
export function placementTap(x: number, y: number, occupied: readonly MeadowPoint[] = []) {
  const point = snapMeadowPoint(x, y)
  const rejection =
    groundAt(x, y, "group") === Ground.Lawn ? checkMeadowPlacement(point, occupied) : "terrain"
  return { point, rejection }
}

/** Every marked spot a decoration could go, given what already stands in the meadow. */
export function placementGuide(occupied: readonly MeadowPoint[] = []) {
  return meadowPlacements(occupied).filter(({ x, y }) => !placementTap(x, y, occupied).rejection)
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
