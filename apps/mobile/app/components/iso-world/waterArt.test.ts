import { seaRock } from "./archipelagoProps"
import { bayFrame, bayTerrain, buildBayScene } from "./bayWorkshop"
import { createBitmap, type Bitmap } from "./bitmap"
import { paintCoastFoam } from "./coastArt"
import { paintGround, SLAB, waterGlints } from "./paint"
import { mapFrame } from "./projection"
import { rock, type Sprite } from "./props"
import { type Drawable } from "./scene"
import { tileMapFromRows } from "./tilemap"
import { pondWaterColor } from "./waterArt"

const alpha = ({ rgba }: Bitmap) => rgba.filter((_, i) => i % 4 === 3)
const anchor = ({ x, y, baseX, baseY, width, height, depth, hit }: Drawable) => ({
  x,
  y,
  baseX,
  baseY,
  width,
  height,
  depth,
  hit,
})

it("repaints foam only on the original spray pixels, including after adding a bay cell", () => {
  const additions = [{ col: 6, row: 6 }]
  for (const cells of [[], additions]) {
    const base = bayTerrain(cells, "terracotta")
    const detailed = bayTerrain(cells, "terracotta", true)
    const foam = [base, detailed].map((map) => {
      const bitmap = createBitmap(bayFrame.width, bayFrame.height)
      paintCoastFoam(bitmap, bayFrame, map, SLAB)
      return bitmap
    })
    expect(alpha(foam[1]!)).toEqual(alpha(foam[0]!))
    expect(foam[1]!.rgba).not.toEqual(foam[0]!.rgba)
    expect(base.tiles).toEqual(detailed.tiles)
  }
})

it("keeps the pond footprint and glint coordinates while painting four shallow banks", () => {
  const base = tileMapFromRows(["gggg", "gwwg", "gswg", "gggg"])
  const detailed = { ...base, art: "detailed" as const }
  const frame = mapFrame(base.cols, base.rows)
  expect(waterGlints(detailed, frame)).toEqual(waterGlints(base, frame))
  expect(alpha(paintGround(detailed, frame))).toEqual(alpha(paintGround(base, frame)))
  expect(pondWaterColor(6, 5, 0)).not.toBe(pondWaterColor(6, 5, 1))
})

it.each<[string, (seed: number, detailed?: boolean) => Sprite]>([
  ["forest-rim", rock],
  ["sea", seaRock],
])("repaints the %s rocks without moving their silhouettes or ground contact", (_, make) => {
  for (const seed of [0.2, 0.68]) {
    const old = make(seed, false)
    const next = make(seed, true)
    expect(next).toMatchObject({ anchorX: old.anchorX, anchorY: old.anchorY })
    expect(next.bitmap).toMatchObject({ width: old.bitmap.width, height: old.bitmap.height })
    expect(alpha(next.bitmap)).toEqual(alpha(old.bitmap))
    expect(next.bitmap.rgba).not.toEqual(old.bitmap.rgba)
  }
})

it("keeps every prop in the same place in the harbor preview", () => {
  const scenes = [false, true].map((detailed) =>
    buildBayScene(bayTerrain([], "terracotta", detailed), "terracotta", 3, { view: "harbor" }),
  )
  expect(scenes[1]!.drawables.map(anchor)).toEqual(scenes[0]!.drawables.map(anchor))
})
