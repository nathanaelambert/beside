import { rgb } from "./bitmap"
import { recolor } from "./islandPalettes"
import { paintGround, waterEdgeDistance, waterGlints } from "./paint"
import { picnicClothRamp } from "./picnicArt"
import { pondBankClearance } from "./pondArt"
import { mapFrame, screenToIso } from "./projection"
import { paintSurfaceFinish } from "./surfaceFinish"
import { tileAt, tileMapFromRows, type TileMap } from "./tilemap"

const terrain = tileMapFromRows([
  ".......",
  ".bbggg.",
  ".bbgsg.",
  ".ggwww.",
  ".gswwg.",
  ".ggwgg.",
  ".......",
])
const original: TileMap = { ...terrain, art: "detailed", coast: "sandstone" }
const detailed: TileMap = { ...original, surfaceFinish: "fine-grain" }
const frame = mapFrame(detailed.cols, detailed.rows)

it("adds native accents only to existing fabric and open water, never the bank or inset", () => {
  // Home's base paint can change grass and dry sand independently of this
  // overlay. The base footprint is still the same in both modes.
  const before = paintGround(detailed, frame)
  const originalGround = paintGround(original, frame)
  const coverage = (bytes: Uint8Array) => bytes.filter((_, i) => i % 4 === 3)
  expect(coverage(before.rgba)).toEqual(coverage(originalGround.rgba))
  const basePixels = before.rgba.slice()
  expect(waterGlints(detailed, frame)).toEqual(waterGlints(original, frame))
  expect(paintSurfaceFinish(original, frame, originalGround)).toBeUndefined()

  const { bitmap, x, y, width, height } = paintSurfaceFinish(detailed, frame, before)!
  expect(bitmap).toMatchObject({ width: width * 3, height: height * 3 })
  expect(width * height).toBeLessThan(frame.width * frame.height)
  const colors = new Set(picnicClothRamp.slice(1).map((tone) => rgb(tone).join(",")))
  let linen = 0
  let water = 0
  for (let sy = 0; sy < bitmap.height; sy++) {
    for (let sx = 0; sx < bitmap.width; sx++) {
      if (!bitmap.rgba[(sy * bitmap.width + sx) * 4 + 3]) continue
      const px = x + Math.floor(sx / 3)
      const py = y + Math.floor(sy / 3)
      const i = (py * before.width + px) * 4
      expect(before.rgba[i + 3]).toBe(255)
      if (colors.has(before.rgba.subarray(i, i + 3).join(","))) {
        const p = screenToIso(frame, px + 0.5, py + 0.5)
        expect(tileAt(detailed, Math.floor(p.u), Math.floor(p.v))?.kind).toBe("blanket")
        linen++
      } else {
        const p = screenToIso(frame, px + 0.5, py + 0.5, -3)
        const tile = tileAt(detailed, Math.floor(p.u), Math.floor(p.v))!
        expect(tile.kind).toBe("water")
        expect(waterEdgeDistance(detailed, tile, p.u - tile.col, p.v - tile.row)).toBeGreaterThan(
          pondBankClearance,
        )
        water++
      }
    }
  }
  expect(linen).toBeGreaterThan(0)
  expect(water).toBeGreaterThan(0)
  expect(before.rgba).toEqual(basePixels)
})

it("follows a regional cloth palette without changing the masks or art placement", () => {
  const base = paintGround(detailed, frame)
  const rose = paintSurfaceFinish(detailed, frame, base)!
  const fern = paintSurfaceFinish(detailed, frame, base, recolor(base, 2))!
  expect([fern.x, fern.y, fern.width, fern.height]).toEqual([
    rose.x,
    rose.y,
    rose.width,
    rose.height,
  ])
  const alpha = (data: Uint8Array) => data.filter((_, i) => i % 4 === 3)
  expect(alpha(rose.bitmap.rgba)).toEqual(alpha(fern.bitmap.rgba))
  expect(fern.bitmap.rgba).not.toEqual(rose.bitmap.rgba)
})
