import { Ground, groundAt, WORLD_HEIGHT, WORLD_WIDTH } from "@beside/api-client/garden"

import { hash } from "./bitmap"
import { CELL, LEVEL } from "./projection"

export type TileKind = "grass" | "forest" | "path" | "water" | "sand" | "dock" | "blanket"

export interface Tile {
  col: number
  row: number
  kind: TileKind
  /** Elevation of the top face in art pixels: forest blocks rise, the pond sinks. */
  lift: number
  /** Stable per-tile random value for texture and prop variety. */
  seed: number
}

export interface TileMap {
  cols: number
  rows: number
  tiles: Tile[]
}

export const tileAt = (map: TileMap, col: number, row: number): Tile | undefined =>
  col < 0 || row < 0 || col >= map.cols || row >= map.rows
    ? undefined
    : map.tiles[row * map.cols + col]

export const liftFor = (kind: TileKind) => (kind === "forest" ? LEVEL : kind === "water" ? -3 : 0)

export function makeTile(col: number, row: number, kind: TileKind): Tile {
  return { col, row, kind, lift: liftFor(kind), seed: hash(col, row, 41) }
}

/** Classify one meadow cell from its pixel census. Order matters: rarer features win. */
export function classifyCell(counts: Record<number, number>, total: number): TileKind {
  const share = (kind: number) => (counts[kind] ?? 0) / total
  if (share(Ground.Water) >= 0.5) return "water"
  if (share(Ground.Dock) >= 0.2) return "dock"
  if (share(Ground.Blanket) >= 0.35) return "blanket"
  if (share(Ground.Woods) >= 0.5) return "forest"
  if (share(Ground.Path) >= 0.22) return "path"
  if (share(Ground.Water) + share(Ground.Shore) >= 0.3) return "sand"
  return "grass"
}

let meadow: TileMap | undefined

/**
 * The home base island: the shared meadow terrain sampled into 16 × 16 pixel cells. Placement
 * rules still read the meadow itself (the same code the API runs), so what is plantable never
 * depends on this rendering.
 */
export function meadowTileMap(): TileMap {
  if (meadow) return meadow
  const cols = WORLD_WIDTH / CELL
  const rows = WORLD_HEIGHT / CELL
  const tiles: Tile[] = []
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const counts: Record<number, number> = {}
      for (let y = 0; y < CELL; y++)
        for (let x = 0; x < CELL; x++) {
          const kind = groundAt(col * CELL + x, row * CELL + y, "group")
          counts[kind] = (counts[kind] ?? 0) + 1
        }
      tiles.push(makeTile(col, row, classifyCell(counts, CELL * CELL)))
    }
  meadow = { cols, rows, tiles }
  return meadow
}

/** Build a small hand-authored map from rows of characters (used by the activity vignette). */
export function tileMapFromRows(rows: string[]): TileMap {
  const kinds: Record<string, TileKind> = {
    g: "grass",
    f: "forest",
    p: "path",
    w: "water",
    s: "sand",
    d: "dock",
    b: "blanket",
  }
  const tiles = rows.flatMap((line, row) =>
    [...line].map((char, col) => makeTile(col, row, kinds[char] ?? "grass")),
  )
  return { cols: rows[0]!.length, rows: rows.length, tiles }
}
