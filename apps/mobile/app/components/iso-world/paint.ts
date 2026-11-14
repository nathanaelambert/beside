// Procedural pixel-art tiles. Every pixel is painted from code (no downloaded art), at one texel
// per art pixel, and is assigned to exactly one tile face by testing its centre against the
// continuous isometric geometry, so neighbouring tiles meet without seams or overlaps.

import { createBitmap, hash, noise, put, type Bitmap } from "./bitmap"
import { HALF_W, isoToScreen, screenToIso, TILE_H, type MapFrame } from "./projection"
import { tileAt, type Tile, type TileKind, type TileMap } from "./tilemap"

/** How far the island's base slab drops below the ground, in art pixels. */
export const SLAB = 14

export const palette = {
  grass: ["#55813f", "#64924a", "#73a253", "#86b25e", "#9cc46c"],
  grassLight: "#bfdc8a",
  forest: ["#355f35", "#3f6c3b", "#4a7a42", "#578a4b"],
  dirt: ["#87633f", "#9c774f", "#b28c60", "#c6a274"],
  pebble: "#dcc49a",
  sand: ["#c8ac74", "#d7bf88", "#e3cf9b", "#efdfb4"],
  water: ["#356f8c", "#3f7f9c", "#4b90ab", "#64a7c0", "#9fd2df"],
  plank: ["#5b3e29", "#7a5538", "#946a45", "#ab8155"],
  blanket: ["#8c4256", "#c4677b", "#ec9aa6", "#f5e6cf"],
  petals: ["#f6f1e1", "#f2c96b", "#ec9aa6", "#b7c6e8"],
  sideLeft: ["#9b6b45", "#8b5e3c", "#7d5434"],
  sideRight: ["#76502f", "#694628", "#5b3d23"],
  stoneLeft: ["#939ca0", "#808a8f", "#6f797e"],
  stoneRight: ["#6f787d", "#626b70", "#555e63"],
  outline: "#3b2a2e",
} as const

const pick = <T>(colors: readonly T[], t: number) =>
  colors[Math.max(0, Math.min(colors.length - 1, Math.floor(t * colors.length)))]!

function topColor(map: TileMap, tile: Tile, fu: number, fv: number, x: number, y: number) {
  const n = noise(x, y, 9, 1) * 0.55 + noise(x, y, 23, 2) * 0.45 + (tile.seed - 0.5) * 0.16
  const grain = hash(x, y, 3)
  const kind: TileKind = tile.kind
  // Edges that drop away get a lit rim, like the reference tiles' bevel.
  const backEdge = fu < 1 / 16 || fv < 1 / 16
  if (kind === "grass" || kind === "forest" || kind === "blanket") {
    if (kind === "blanket") {
      const blanket = blanketColor(map, tile, fu, fv)
      if (blanket) return blanket
    }
    const tones = kind === "forest" ? palette.forest : palette.grass
    if (grain > 0.985) return palette.grassLight
    if (grain > 0.94) return tones[0]!
    if (kind === "grass" && tile.seed > 0.45 && hash(x, y, 9) > 0.988)
      return palette.petals[Math.floor(hash(x, y, 10) * palette.petals.length)]!
    const tone = pick(tones, n * 0.9 + (backEdge ? 0.22 : 0))
    return tone
  }
  if (kind === "path") {
    if (grain > 0.972) return palette.pebble
    if (hash(x, y - 1, 3) > 0.972) return palette.dirt[0]!
    return pick(palette.dirt, n * 0.85 + 0.1)
  }
  if (kind === "sand") {
    if (grain > 0.97) return palette.sand[0]!
    return pick(palette.sand, n * 0.8 + 0.2)
  }
  if (kind === "dock") {
    // Planks run along u; seams every quarter tile, with a nail now and then.
    const plank = Math.floor(fv * 4)
    const seam = fv * 4 - plank < 0.12
    if (seam) return palette.plank[0]!
    if (grain > 0.985) return palette.plank[0]!
    return palette.plank[1 + ((plank + (n > 0.55 ? 1 : 0)) % 3)]!
  }
  // Water: banded ripples that follow the iso axis, foam where it meets land.
  const shoreU = fu < 1 / 16 ? tileAt(map, tile.col - 1, tile.row) : undefined
  const shoreV = fv < 1 / 16 ? tileAt(map, tile.col, tile.row - 1) : undefined
  if ((shoreU && shoreU.kind !== "water") || (shoreV && shoreV.kind !== "water"))
    return palette.water[4]!
  const ripple = (y * 2 + Math.floor((x + Math.floor(noise(x, y, 11, 7) * 6)) / 7)) % 9 === 0
  if (ripple && hash(x >> 2, y, 12) > 0.45) return palette.water[3]!
  return pick(palette.water, n * 0.6 + 0.15)
}

function blanketColor(map: TileMap, tile: Tile, fu: number, fv: number) {
  const inset = 0.14
  const isBlanket = (dc: number, dr: number) =>
    tileAt(map, tile.col + dc, tile.row + dr)?.kind === "blanket"
  const u0 = isBlanket(-1, 0) ? 0 : inset
  const u1 = isBlanket(1, 0) ? 1 : 1 - inset
  const v0 = isBlanket(0, -1) ? 0 : inset
  const v1 = isBlanket(0, 1) ? 1 : 1 - inset
  if (fu < u0 || fu >= u1 || fv < v0 || fv >= v1) return undefined
  const border = 0.07
  if (
    (u0 > 0 && fu < u0 + border) ||
    (u1 < 1 && fu > u1 - border) ||
    (v0 > 0 && fv < v0 + border) ||
    (v1 < 1 && fv > v1 - border)
  )
    return palette.blanket[0]
  const check = (Math.floor(fu * 4) + Math.floor(fv * 4)) % 2
  const stripe = Math.floor(fu * 8) % 2 === 0 || Math.floor(fv * 8) % 2 === 0
  return check ? (stripe ? palette.blanket[1] : palette.blanket[2]) : palette.blanket[3]
}

function sideColor(face: "left" | "right", tile: Tile, depth: number, x: number, y: number) {
  const tones = tile.kind === "forest" ? palette.forest : palette.grass
  const lip =
    tile.kind === "water"
      ? palette.water[0]
      : tile.kind === "sand"
        ? palette.sand[0]
        : tile.kind === "path"
          ? palette.dirt[0]
          : tile.kind === "dock"
            ? palette.plank[0]
            : tones[0]
  if (depth < 2 && tile.kind !== "dock") return lip!
  const stone = depth >= 2 + 9
  const set = stone
    ? face === "left"
      ? palette.stoneLeft
      : palette.stoneRight
    : face === "left"
      ? palette.sideLeft
      : palette.sideRight
  // Stone courses: mortar every 4 rows, staggered joints.
  if (stone) {
    const course = Math.floor((depth - 11) / 4)
    if ((depth - 11) % 4 === 3) return set[2]!
    if ((x + course * 3) % 8 === 0) return set[2]!
    return hash(x, y, 21) > 0.9 ? set[1]! : set[0]!
  }
  const n = noise(x, y, 5, 17)
  if (hash(x, y, 19) > 0.93) return set[2]!
  return n > 0.62 ? set[1]! : set[0]!
}

/** Paint a tile's top face. `ox`/`oy` shift the output (for standalone block bitmaps). */
function paintTop(bitmap: Bitmap, frame: MapFrame, map: TileMap, tile: Tile, ox = 0, oy = 0) {
  const top = isoToScreen(frame, tile.col, tile.row, tile.lift)
  const x0 = Math.floor(top.x - HALF_W)
  const y0 = Math.floor(top.y)
  for (let y = y0; y < y0 + TILE_H; y++)
    for (let x = x0; x < x0 + HALF_W * 2; x++) {
      const p = screenToIso(frame, x + 0.5, y + 0.5, tile.lift)
      if (Math.floor(p.u) !== tile.col || Math.floor(p.v) !== tile.row) continue
      put(
        bitmap,
        x - ox,
        y - oy,
        topColor(map, tile, p.u - tile.col, p.v - tile.row, x, y + tile.lift),
      )
    }
}

/** Paint the two front faces wherever this tile stands above its neighbour (or the void). */
function paintSides(bitmap: Bitmap, frame: MapFrame, map: TileMap, tile: Tile, ox = 0, oy = 0) {
  const { col, row, lift } = tile
  const faces = [
    { face: "left" as const, from: [col, row + 1], to: [col + 1, row + 1], next: [col, row + 1] },
    { face: "right" as const, from: [col + 1, row + 1], to: [col + 1, row], next: [col + 1, row] },
  ]
  for (const { face, from, to, next } of faces) {
    const neighbour = tileAt(map, next[0]!, next[1]!)
    const bottom = neighbour ? neighbour.lift : -SLAB
    const height = lift - bottom
    if (height <= 0) continue
    const a = isoToScreen(frame, from[0]!, from[1]!, lift)
    const b = isoToScreen(frame, to[0]!, to[1]!, lift)
    for (let x = Math.round(a.x); x < Math.round(b.x); x++) {
      const t = (x + 0.5 - a.x) / (b.x - a.x)
      const edge = a.y + t * (b.y - a.y)
      for (let y = Math.floor(edge - 0.5); y < edge + height + 1; y++) {
        const depth = y + 0.5 - edge
        if (depth < 0 || depth >= height) continue
        const color =
          !neighbour && depth >= height - 1 ? palette.outline : sideColor(face, tile, depth, x, y)
        put(bitmap, x - ox, y - oy, color)
      }
    }
  }
}

/** Raised blocks are drawn as their own sprites so they can sort with avatars and props. */
export const isRaised = (tile: Tile) => tile.lift > 0

export function paintGround(map: TileMap, frame: MapFrame): Bitmap {
  const bitmap = createBitmap(frame.width, frame.height)
  const ordered = [...map.tiles]
    .filter((tile) => !isRaised(tile))
    .sort((a, b) => a.col + a.row - (b.col + b.row) || a.col - b.col)
  for (const tile of ordered) {
    paintSides(bitmap, frame, map, tile)
    paintTop(bitmap, frame, map, tile)
  }
  return bitmap
}

export interface BlockSprite {
  bitmap: Bitmap
  /** Where the bitmap's top-left lands in the map frame. */
  x: number
  y: number
}

export function paintBlock(map: TileMap, frame: MapFrame, tile: Tile): BlockSprite {
  const top = isoToScreen(frame, tile.col, tile.row, tile.lift)
  const x = Math.floor(top.x - HALF_W)
  const y = Math.floor(top.y)
  const bitmap = createBitmap(HALF_W * 2, TILE_H + tile.lift + SLAB + 1)
  paintSides(bitmap, frame, map, tile, x, y)
  paintTop(bitmap, frame, map, tile, x, y)
  return { bitmap, x, y }
}

/** Pixel offsets inside the water that twinkle, for the canvas's stepped animation. */
export function waterGlints(map: TileMap, frame: MapFrame) {
  return map.tiles
    .filter((tile) => tile.kind === "water" && tile.seed > 0.35)
    .map((tile, index) => {
      const p = isoToScreen(frame, tile.col + 0.3 + tile.seed * 0.4, tile.row + 0.5, tile.lift)
      return { x: Math.round(p.x), y: Math.round(p.y), phase: index * 3 }
    })
}

/** A seamless 64 × 32 patch of open water that surrounds the floating island. */
export const SEA_TILE = { width: 64, height: 32 }
let sea: Bitmap | undefined
export function seaTile(): Bitmap {
  if (sea) return sea
  const { width, height } = SEA_TILE
  sea = createBitmap(width, height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      put(sea, x, y, (x + y * 2) % 7 === 0 && hash(x >> 3, y, 61) > 0.93 ? "#356877" : "#2f5d6b")
  // Short wave crests, placed on a staggered grid so the repeat is hard to spot.
  for (const [x, y] of [
    [6, 5],
    [38, 9],
    [22, 19],
    [52, 25],
    [10, 27],
  ] as const) {
    for (let i = 0; i < 5; i++)
      put(sea, (x + i) % width, y, i === 0 || i === 4 ? "#3f7486" : "#5b8f9c")
    put(sea, (x + 1) % width, y - 1, "#3f7486")
  }
  return sea
}
