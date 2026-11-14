import { WORLD_HEIGHT, WORLD_WIDTH } from "./terrain"

export interface WorldFraming {
  scale: number
  centerX: number
  centerY: number
}

export type CameraOffset = { x: number; y: number; scale: number }

export function cameraFrame(width: number, height: number, framing?: WorldFraming) {
  const scale = framing?.scale ?? Math.max(1, Math.floor(width / 176))
  const axis = (viewport: number, extent: number, center: number) => {
    const offset = Math.round(viewport / 2 - center * scale)
    return viewport >= extent * scale
      ? Math.round((viewport - extent * scale) / 2)
      : Math.min(0, Math.max(viewport - extent * scale, offset))
  }
  return {
    scale,
    x: axis(width, WORLD_WIDTH, framing?.centerX ?? WORLD_WIDTH / 2),
    y: axis(height, WORLD_HEIGHT, framing?.centerY ?? WORLD_HEIGHT / 2),
  }
}
