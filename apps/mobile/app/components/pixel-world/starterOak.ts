import {
  checkStarterOakPlacement,
  Ground,
  groundAt,
  snapMeadowPoint,
  starterOakItemId,
  starterOakPlacements,
  type MeadowPoint,
} from "@beside/api-client/garden"

export const oakPlantingPulseMs = 760

let guidePoints: readonly MeadowPoint[] | undefined

export function starterOakTap(x: number, y: number) {
  const point = snapMeadowPoint(x, y)
  const rejection =
    groundAt(x, y, "group") === Ground.Lawn ? checkStarterOakPlacement(point) : "terrain"
  return { point, rejection }
}

export function starterOakGuidePoints() {
  // Use the same terrain check as a direct tap, in addition to the server's grid rules.
  guidePoints ??= starterOakPlacements().filter(({ x, y }) => !starterOakTap(x, y).rejection)
  return guidePoints
}

export function oakAt({ x, y }: MeadowPoint, key = "starter-oak") {
  return { key, itemId: starterOakItemId, x, y }
}
