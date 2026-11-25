import { rgb, type Bitmap } from "./bitmap"
import { islandPalettes, recolor } from "./islandPalettes"
import { meadowRamps, meadowShrub } from "./meadowArt"
import { paintBlock, paintGround } from "./paint"
import { mapFrame } from "./projection"
import { bush } from "./props"
import { terrainDrawables, type Drawable } from "./scene"
import { meadowTileMap, tileAt } from "./tilemap"

const mask = ({ rgba }: Bitmap) => rgba.filter((_, i) => i % 4 === 3)
const anchor = ({ key, depth, baseX, baseY, hit }: Drawable) => ({
  key,
  depth,
  baseX,
  baseY,
  hit,
})

it.each([0.2, 0.8])("lowers shrub variant %s above the original ground contact", (seed) => {
  const source = bush(seed).bitmap
  const before = source.rgba.slice()
  const result = meadowShrub(source)
  expect(result).toMatchObject({ width: source.width, height: source.height })
  expect(mask(result).slice(11 * source.width)).toEqual(mask(source).slice(11 * source.width))
  const topRow = (bitmap: Bitmap) => Math.floor(mask(bitmap).findIndex(Boolean) / bitmap.width)
  expect(topRow(result) - topRow(source)).toBe(2)
  expect(result.rgba).not.toEqual(source.rgba)
  expect(source.rgba).toEqual(before)
  expect(meadowShrub(source)).toBe(result)
})

it("keeps every map prop in place and leaves the border shrubs in the breeze", () => {
  const original = meadowTileMap()
  const detailed = { ...original, art: "detailed" as const }
  const frame = mapFrame(original.cols, original.rows)
  const earlier = terrainDrawables(original, frame)
  const now = terrainDrawables(detailed, frame)
  expect(now.map(anchor)).toEqual(earlier.map(anchor))
  const shrubs = now.filter((entry) => entry.foliage === "shrub")
  expect(shrubs.length).toBeGreaterThan(2)
  for (const shrub of shrubs) {
    const old = earlier.find((entry) => entry.key === shrub.key)!
    expect(shrub).toMatchObject({ x: old.x, y: old.y, width: old.width, height: old.height })
    expect(shrub.top).toBe(old.top + 2)
    expect(shrub.source.type).toBe("bitmap")
    expect(old.source.type).toBe("bitmap")
    if (shrub.source.type === "bitmap" && old.source.type === "bitmap") {
      const foot = 11 * old.width
      expect(mask(shrub.source.bitmap).slice(foot)).toEqual(mask(old.source.bitmap).slice(foot))
      expect(shrub.source.bitmap.rgba).not.toEqual(old.source.bitmap.rgba)
    }
  }
})

it("keeps the top and raised terrain masks, and recolors the meadow for every island variant", () => {
  const original = meadowTileMap()
  const ordinary = { ...original, art: "detailed" as const }
  const detailed = { ...ordinary, surfaceFinish: "fine-grain" as const }
  const frame = mapFrame(original.cols, original.rows)
  const ground = paintGround(detailed, frame)
  expect(mask(ground)).toEqual(mask(paintGround(original, frame)))
  expect(ground.rgba).not.toEqual(paintGround(ordinary, frame).rgba)
  const forest = tileAt(original, 1, 0)!
  expect(forest.kind).toBe("forest")
  const block = paintBlock(detailed, frame, forest)
  const originalBlock = paintBlock(original, frame, forest)
  expect(block).toMatchObject({ x: originalBlock.x, y: originalBlock.y })
  expect(mask(block.bitmap)).toEqual(mask(originalBlock.bitmap))
  expect(block.bitmap.rgba).not.toEqual(originalBlock.bitmap.rgba)
  expect(block.bitmap.rgba).toEqual(paintBlock(ordinary, frame, forest).bitmap.rgba)
  for (const [index, palette] of islandPalettes.entries()) {
    if (index === 0) continue
    const variant = recolor(ground, index)
    expect(mask(variant)).toEqual(mask(ground))
    const [r, g, b] = rgb(meadowRamps.grass[2])
    const bytes = ground.rgba
    const paintedPixel = bytes.findIndex(
      (n, i) =>
        i % 4 === 0 && n === r && bytes[i + 1] === g && bytes[i + 2] === b && bytes[i + 3] > 0,
    )
    expect(paintedPixel).toBeGreaterThanOrEqual(0)
    expect([...variant.rgba.slice(paintedPixel, paintedPixel + 3)]).toEqual(
      rgb(palette.swap[meadowRamps.grass[2]]!),
    )
  }
})
