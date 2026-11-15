import {
  checkMeadowPlacement,
  Ground,
  groundAt,
  meadowPlacements,
  snapMeadowPoint,
  starterOakItemId,
  type MeadowPoint,
} from "@beside/api-client/garden"

export const oakPlantingPulseMs = 760

let openGuidePoints: readonly MeadowPoint[] | undefined

/**
 * Where a tap would place something in the home-base meadow: the oak or any
 * bought decoration. `occupied` lists what already stands there.
 */
export function starterOakTap(x: number, y: number, occupied: readonly MeadowPoint[] = []) {
  const point = snapMeadowPoint(x, y)
  const rejection =
    groundAt(x, y, "group") === Ground.Lawn ? checkMeadowPlacement(point, occupied) : "terrain"
  return { point, rejection }
}

export function starterOakGuidePoints(occupied: readonly MeadowPoint[] = []) {
  // Use the same terrain check as a direct tap, in addition to the server's grid rules.
  if (!occupied.length)
    return (openGuidePoints ??= meadowPlacements().filter(
      ({ x, y }) => !starterOakTap(x, y).rejection,
    ))
  return meadowPlacements(occupied).filter(({ x, y }) => !starterOakTap(x, y, occupied).rejection)
}

export function oakAt({ x, y }: MeadowPoint, key = "starter-oak") {
  return { key, itemId: starterOakItemId, x, y }
}
