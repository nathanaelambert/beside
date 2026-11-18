import type { ScreenPoint } from "./projection"
import { isoToScreen, screenToIso, type MapFrame } from "./projection"
import { hitTest, opaqueAt, type Drawable } from "./scene"
import type { TileMap } from "./tilemap"

export interface IslandLayer {
  key: string
  map: TileMap
  frame: MapFrame
  drawables: Drawable[]
  /** Top-left of the map frame in sea art pixels. */
  offset: ScreenPoint
  sign?: Drawable
  /** The same sign with a "you are here" pennant, shown on the focused island. */
  signHere?: Drawable
  /** Index into islandPalettes: the island's grass and blanket colours. */
  palette?: number
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
      return [id, { x: index === 0 ? 0 : (index % 2 ? 176 : 0) + ((n >>> 8) % 25) - 12, y }]
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
  signScale = 1,
) {
  const ordered = [...islands].sort((a, b) => b.offset.y - a.offset.y)
  for (const island of ordered) {
    const x = point.x - island.offset.x
    const y = point.y - island.offset.y
    const sign = island.sign
    const onSign =
      showSigns &&
      sign &&
      x >= sign.baseX + (sign.x - sign.baseX) * signScale &&
      x <= sign.baseX + (sign.x + sign.width - sign.baseX) * signScale &&
      y >= sign.baseY + (sign.y - sign.baseY) * signScale &&
      y <= sign.baseY + (sign.y + sign.height - sign.baseY) * signScale
    const hit = hitTest(island.drawables, x, y, minSize)
    if (
      onSign ||
      hit ||
      onIsland(island, point) ||
      island.drawables.some((drawable) => opaqueAt(drawable, x, y))
    )
      return { islandKey: island.key, x, y, hit }
  }
  return { x: point.x, y: point.y }
}

/** Only the focused island has the signed-in member; during a voyage they are on the boat. */
export function focusedIslandLayers(
  layers: IslandLayer[],
  focusedKey: string | undefined,
  userId: string | undefined,
  travelling: boolean,
  preview?: Drawable,
) {
  return layers.map((layer) => {
    const focused = layer.key === focusedKey
    const hideSelf = layers.length > 1 && (!focused || travelling)
    const drawables = hideSelf
      ? layer.drawables.filter((drawable) => drawable.key !== `avatar-${userId}`)
      : layer.drawables
    if (focused && preview)
      return {
        ...layer,
        drawables: [...drawables, preview].sort((a, b) => a.depth - b.depth || a.baseX - b.baseX),
      }
    return drawables === layer.drawables ? layer : { ...layer, drawables }
  })
}

/** Zoom is points/art pixel, with an integer number of device pixels for every texel. */
export function zoomStops(pixelRatio: number, multipleIslands: boolean) {
  const ratio = Math.max(1, pixelRatio)
  const first = multipleIslands ? 1 : Math.ceil(ratio)
  const stops = Array.from(
    { length: Math.floor(4 * ratio) - first + 1 },
    (_, i) => (first + i) / ratio,
  )
  // Low-density screens (most desktop browsers) can't reach a whole-archipelago view in whole
  // device pixels, so they also get a few sub-pixel stops. Phones (2×, 3×) never need them.
  if (!multipleIslands) return stops
  return [...[1 / 3, 1 / 2, 2 / 3].filter((zoom) => zoom < stops[0]! - 0.001), ...stops]
}

/**
 * Points per sign pixel. Signs keep this size at every world zoom so the names stay readable
 * from far out: about 1.3 pt per pixel, rounded to whole device pixels.
 */
export function signScale(pixelRatio: number) {
  const ratio = Math.max(1, pixelRatio)
  return Math.max(2, Math.round(ratio * 1.34)) / ratio
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

export interface SeaProp {
  key: string
  kind: "rock" | "buoy"
  /** Waterline anchor in sea art pixels. */
  x: number
  y: number
  seed: number
}

/**
 * A few things in the open water so the channels between islands read as sea, not empty
 * background: rocks (some with a resting gull) out to the west of each channel, where the
 * boat never goes, and a buoy marking each channel near the jetties on the east.
 */
export function seaProps(islands: readonly Pick<IslandLayer, "key" | "frame" | "offset">[]) {
  const ordered = [...islands].sort((a, b) => a.offset.y - b.offset.y)
  const props: SeaProp[] = []
  ordered.slice(1).forEach((lower, index) => {
    const upper = ordered[index]!
    const n = seed(`${upper.key}|${lower.key}`)
    const r = (shift: number) => ((n >>> shift) % 1000) / 1000
    // The upper island's south corner and the lower island's north corner bound the channel.
    const southCorner = islandPoint(upper, 18, 15)
    const north = islandPoint(lower, 0, 0)
    const midX = (southCorner.x + north.x) / 2
    const midY = (southCorner.y + 14 + north.y) / 2
    props.push(
      {
        key: `rock-${index}-a`,
        kind: "rock",
        x: Math.round(midX - 230 - r(0) * 40),
        y: Math.round(midY - 10 + r(4) * 20),
        seed: 0.5 + r(8) * 0.5,
      },
      {
        key: `rock-${index}-b`,
        kind: "rock",
        x: Math.round(midX - 185 - r(12) * 20),
        y: Math.round(midY + 22 + r(16) * 10),
        seed: r(20) * 0.4,
      },
      {
        key: `buoy-${index}`,
        kind: "buoy",
        x: Math.round(midX + 170 + r(24) * 30),
        y: Math.round(midY - 6 + r(2) * 12),
        seed: r(6),
      },
    )
  })
  return props
}
