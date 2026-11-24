import { createBitmap, put, rgb, type Bitmap, type Rgb } from "./bitmap"
import { visitTileTop, waterEdgeDistance } from "./paint"
import { linenGrain, picnicClothRamp } from "./picnicArt"
import { pondBankClearance, quietPondColor, type PondBounds } from "./pondArt"
import { HALF_W, isoToScreen, screenToIso, TILE_H, type MapFrame } from "./projection"
import type { Tile, TileMap } from "./tilemap"
import { pondWaterColor } from "./waterArt"

const scale = 3
const cloth = picnicClothRamp.map(rgb)

function matches({ rgba }: Bitmap, i: number, color: Rgb) {
  return (
    rgba[i + 3] === 255 &&
    rgba[i] === color[0] &&
    rgba[i + 1] === color[1] &&
    rgba[i + 2] === color[2]
  )
}

const tint = (base: number, delta: number) => Math.max(0, Math.min(255, Math.round(base + delta)))

function topBounds(frame: MapFrame, tiles: Tile[]): PondBounds {
  const corners = tiles.map((tile) => isoToScreen(frame, tile.col, tile.row, tile.lift))
  const x = Math.max(0, Math.min(...corners.map((p) => p.x)) - HALF_W)
  const y = Math.max(0, Math.min(...corners.map((p) => p.y)))
  const width = Math.min(frame.width, Math.max(...corners.map((p) => p.x)) + HALF_W) - x
  const height = Math.min(frame.height, Math.max(...corners.map((p) => p.y)) + TILE_H) - y
  return { x, y, width, height }
}

/** One small, cached texture. The 1× ground is still authoritative for every footprint. */
export function paintSurfaceFinish(map: TileMap, frame: MapFrame, base: Bitmap, ground = base) {
  if (map.surfaceFinish !== "fine-grain") return
  const tiles = map.tiles.filter(
    (tile) => tile.lift <= 0 && (tile.kind === "water" || tile.kind === "blanket"),
  )
  if (tiles.length === 0) return

  const { x, y, width, height } = topBounds(frame, tiles)
  const waterTiles = tiles.filter((tile) => tile.kind === "water")
  const pond = waterTiles.length ? topBounds(frame, waterTiles) : undefined
  const bitmap = createBitmap(width * scale, height * scale)

  for (const tile of tiles) {
    visitTileTop(frame, tile, (px, py, u, v) => {
      if (px < x || py < y || px >= x + width || py >= y + height) return
      const i = (py * base.width + px) * 4
      const water = tile.kind === "water" ? pond : undefined
      const bank = water ? waterEdgeDistance(map, tile, u, v) : 0
      const hem = water ? -1 : cloth.findIndex((color) => matches(base, i, color))
      if (water) {
        // If the base raster shows a bank side over this water pixel, do not cover it.
        if (
          bank <= pondBankClearance ||
          !matches(base, i, rgb(pondWaterColor(px, py + tile.lift, bank)))
        )
          return
      } else if (hem <= 0) {
        // No accents on the outer binding or the inset grass.
        return
      }
      const source: Rgb = [ground.rgba[i]!, ground.rgba[i + 1]!, ground.rgba[i + 2]!]

      for (let sy = 0; sy < scale; sy++) {
        const ay = py + (sy + 0.5) / scale
        for (let sx = 0; sx < scale; sx++) {
          const ax = px + (sx + 0.5) / scale
          const outX = (px - x) * scale + sx
          const outY = (py - y) * scale + sy
          if (water) {
            put(bitmap, outX, outY, quietPondColor(ax, ay, bank, water, source))
            continue
          }
          const p = screenToIso(frame, ax, ay, tile.lift)
          const shade = linenGrain(p.u, p.v, hem < 3)
          if (!shade) continue
          // Read the displayed island palette, so the warmer fabric stays local to its island.
          put(bitmap, outX, outY, [
            tint(source[0], shade),
            tint(source[1], shade),
            tint(source[2], shade * 0.9),
          ])
        }
      }
    })
  }
  return { bitmap, x, y, width, height }
}
