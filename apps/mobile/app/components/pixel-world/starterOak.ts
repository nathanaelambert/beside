import {
  checkStarterOakPlacement,
  Ground,
  groundAt,
  snapMeadowPoint,
  starterOakItemId,
  starterOakPlacements,
  type MeadowPoint,
} from "@beside/api-client/garden"

import { cameraFrame, type CameraOffset, type WorldFraming } from "./camera"

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

export type MeadowViewport = { width: number; height: number }
export type MeadowOverlay = MeadowPoint & MeadowViewport

function isVisibleOak(
  x: number,
  y: number,
  margin: number,
  viewport: MeadowViewport,
  overlay: MeadowOverlay,
) {
  return (
    x >= margin &&
    x <= viewport.width - margin &&
    y >= margin &&
    y <= viewport.height - margin &&
    (x < overlay.x - margin ||
      x > overlay.x + overlay.width + margin ||
      y < overlay.y - margin ||
      y > overlay.y + overlay.height + margin)
  )
}

export function suggestVisibleOak(
  camera: CameraOffset,
  viewport: MeadowViewport,
  overlay: MeadowOverlay,
  previous?: MeadowPoint,
) {
  const clearHeight = Math.min(viewport.height, overlay.y)
  const points = starterOakGuidePoints()
    .map((point) => ({
      point,
      x: camera.x + point.x * camera.scale,
      y: camera.y + point.y * camera.scale,
    }))
    .filter(({ x, y }) => isVisibleOak(x, y, camera.scale * 2, viewport, overlay))
    .sort(
      (a, b) =>
        Math.hypot(a.x - viewport.width / 2, a.y - clearHeight / 2) -
        Math.hypot(b.x - viewport.width / 2, b.y - clearHeight / 2),
    )
  const index = points.findIndex(({ point }) => point.x === previous?.x && point.y === previous.y)
  return points[(index + 1) % points.length]?.point
}

export function findOakInAnotherArea(
  framing: WorldFraming,
  viewport: MeadowViewport,
  overlay: MeadowOverlay,
) {
  // An explicit fallback may move the camera. Aim above the tray, then apply normal world bounds.
  const visibleHeight = Math.max(0, Math.min(viewport.height, overlay.y))
  const points = [...starterOakGuidePoints()].sort(
    (a, b) =>
      Math.hypot(a.x - framing.centerX, a.y - framing.centerY) -
      Math.hypot(b.x - framing.centerX, b.y - framing.centerY),
  )
  for (const point of points) {
    const { x, y } = point
    const focus = {
      ...framing,
      centerX: x,
      centerY: y + (viewport.height - visibleHeight) / (2 * framing.scale),
    }
    const { x: offsetX, y: offsetY, scale } = cameraFrame(viewport.width, viewport.height, focus)
    if (isVisibleOak(offsetX + x * scale, offsetY + y * scale, scale * 2, viewport, overlay))
      return { focus, point }
  }
  return undefined
}
