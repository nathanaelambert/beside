import type { ScreenPoint } from "./projection"
import { isoToScreen, screenToIso, type MapFrame } from "./projection"
import { hitTest, type Drawable } from "./scene"
import type { TileMap } from "./tilemap"

export interface IslandLayer {
  key: string
  map: TileMap
  frame: MapFrame
  drawables: Drawable[]
  /** Top-left of the map frame in sea art pixels. */
  offset: ScreenPoint
  sign?: Drawable
}

export const ISLAND_SIZE = { width: 552, height: 348 }

function seed(id: string) {
  let value = 2166136261
  for (let i = 0; i < id.length; i++) value = Math.imul(value ^ id.charCodeAt(i), 16777619)
  return value >>> 0
}

/** Stable portrait zig-zag. Call with the opening home base first, then API order. */
export function archipelagoLayout(ids: readonly string[]): Record<string, ScreenPoint> {
  let y = 0
  return Object.fromEntries(
    ids.map((id, index) => {
      const n = seed(id)
      if (index) y += ISLAND_SIZE.height + 96 + (n % 33)
      return [id, { x: index === 0 ? 0 : (index % 2 ? 116 : 0) + ((n >>> 8) % 25) - 12, y }]
    }),
  )
}

export function islandPoint(
  island: Pick<IslandLayer, "frame" | "offset">,
  u: number,
  v: number,
  lift = 0,
) {
  const point = isoToScreen(island.frame, u, v, lift)
  return { x: point.x + island.offset.x, y: point.y + island.offset.y }
}

export function archipelagoBounds(islands: readonly IslandLayer[], margin = 64) {
  if (!islands.length) return { x: 0, y: 0, width: 0, height: 0 }
  const x = Math.min(...islands.map((i) => i.offset.x)) - margin
  const y = Math.min(...islands.map((i) => i.offset.y)) - margin
  return {
    x,
    y,
    width: Math.max(...islands.map((i) => i.offset.x + i.frame.width)) + margin - x,
    height: Math.max(...islands.map((i) => i.offset.y + i.frame.height)) + margin - y,
  }
}

/** The whole land diamond, including the slab below its top face. */
export function onIsland(island: IslandLayer, point: ScreenPoint, padding = 0) {
  const x = point.x - island.offset.x
  const y = point.y - island.offset.y
  // Test both top and slab planes, conservatively treating the island's pond as land too.
  return [0, -14].some((lift) => {
    const { u, v } = screenToIso(island.frame, x, y, lift)
    return (
      u >= -padding &&
      v >= -padding &&
      u <= island.map.cols + padding &&
      v <= island.map.rows + padding
    )
  })
}

export function hitTestIslands(
  islands: readonly IslandLayer[],
  point: ScreenPoint,
  minSize: number,
  showSigns = false,
) {
  const ordered = [...islands].sort((a, b) => b.offset.y - a.offset.y)
  for (const island of ordered) {
    const x = point.x - island.offset.x
    const y = point.y - island.offset.y
    const sign = island.sign
    const onSign =
      showSigns &&
      sign &&
      x >= sign.x &&
      x <= sign.x + sign.width &&
      y >= sign.y &&
      y <= sign.y + sign.height
    const hit = hitTest(island.drawables, x, y, minSize)
    if (onSign || hit || onIsland(island, point)) return { islandKey: island.key, x, y, hit }
  }
  return { x: point.x, y: point.y }
}

/** Zoom is points/art pixel, with an integer number of device pixels for every texel. */
export function zoomStops(pixelRatio: number, multipleIslands: boolean) {
  const ratio = Math.max(1, pixelRatio)
  const first = multipleIslands ? 1 : Math.ceil(ratio)
  return Array.from({ length: Math.floor(4 * ratio) - first + 1 }, (_, i) => (first + i) / ratio)
}

export function stepZoom(zoom: number, direction: 1 | -1, stops: readonly number[]) {
  const epsilon = 0.00001
  return direction === 1
    ? (stops.find((stop) => stop > zoom + epsilon) ?? stops[stops.length - 1]!)
    : ([...stops].reverse().find((stop) => stop < zoom - epsilon) ?? stops[0]!)
}

export function snapZoom(zoom: number, stops: readonly number[]) {
  return stops.reduce(
    (best, stop) => (Math.abs(stop - zoom) < Math.abs(best - zoom) ? stop : best),
    stops[0]!,
  )
}
