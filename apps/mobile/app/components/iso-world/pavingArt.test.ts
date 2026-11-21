import { rgb } from "./bitmap"
import { paintGround, waterGlints } from "./paint"
import { HALF_W, isoToScreen, mapFrame, screenToIso, TILE_H, type MapFrame } from "./projection"
import { tileMapFromRows, type Tile, type TileMap } from "./tilemap"

function samples(map: TileMap, frame: MapFrame, tile: Tile) {
  const { width, rgba } = paintGround(map, frame)
  const top = isoToScreen(frame, tile.col, tile.row, tile.lift)
  const pixels: { u: number; v: number; color: string }[] = []
  for (let y = top.y; y < top.y + TILE_H; y++)
    for (let x = top.x - HALF_W; x < top.x + HALF_W; x++) {
      const { u, v } = screenToIso(frame, x + 0.5, y + 0.5, tile.lift)
      if (Math.floor(u) !== tile.col || Math.floor(v) !== tile.row) continue
      const i = (y * width + x) * 4
      pixels.push({ u: u - tile.col, v: v - tile.row, color: rgba.slice(i, i + 3).join(",") })
    }
  return pixels
}

it("repaints connected path tiles without changing their footprint or pond glints", () => {
  const original = tileMapFromRows([".ppp.", ".gpg.", ".gsw.", "....."])
  const detailed = { ...original, art: "detailed" as const }
  const frame = mapFrame(original.cols, original.rows)
  const before = paintGround(original, frame)
  const after = paintGround(detailed, frame)
  const mask = (rgba: Uint8Array) => rgba.filter((_, i) => i % 4 === 3)
  expect(mask(after.rgba)).toEqual(mask(before.rgba))
  expect(waterGlints(detailed, frame)).toEqual(waterGlints(original, frame))
  const path = original.tiles.filter(({ kind }) => kind === "path")
  for (const tile of path) {
    const colors = samples(detailed, frame, tile).map(({ color }) => color)
    expect(colors).not.toEqual(samples(original, frame, tile).map(({ color }) => color))
    expect(new Set(colors).size).toBeGreaterThanOrEqual(5)
  }
})

it("darkens sand at each facing water edge and never wets a sand tile away from water", () => {
  const original = tileMapFromRows(["sgggg", "ggsgg", "gswsg", "ggsgg", "ggggg"])
  const detailed = { ...original, art: "detailed" as const }
  const frame = mapFrame(original.cols, original.rows)
  const wetColors = new Set(
    ["#b8a889", "#ab9b7c", "#c6b591", "#bdab86"].map((c) => rgb(c).join(",")),
  )
  for (const tile of original.tiles.filter(({ kind }) => kind === "sand")) {
    const wet = samples(detailed, frame, tile).filter(({ color }) => wetColors.has(color))
    if (tile.col === 0) {
      expect(wet).toHaveLength(0)
      continue
    }
    expect(wet.length).toBeGreaterThan(0)
    // All darker pixels must face the central pond, never an unrelated edge.
    const distance = (pixel: (typeof wet)[number]) =>
      tile.col === 1
        ? 1 - pixel.u
        : tile.col === 3
          ? pixel.u
          : tile.row === 1
            ? 1 - pixel.v
            : pixel.v
    expect(wet.every((pixel) => distance(pixel) < 0.34)).toBe(true)
  }
})
