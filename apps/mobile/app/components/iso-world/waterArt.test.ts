import { seaRock } from "./archipelagoProps"
import { bayFrame, bayTerrain, buildBayScene } from "./bayWorkshop"
import { createBitmap, type Bitmap } from "./bitmap"
import { paintCoastFoam } from "./coastArt"
import { paintGround, SLAB, waterGlints } from "./paint"
import { pondBankClearance, pondReflection, quietPondColor } from "./pondArt"
import { mapFrame } from "./projection"
import { rock, type Sprite } from "./props"
import { type Drawable } from "./scene"
import { tileMapFromRows } from "./tilemap"
import { pondWaterColor } from "./waterArt"

const alpha = ({ rgba }: Bitmap) => rgba.filter((_, i) => i % 4 === 3)
const anchor = ({ key, baseX, baseY, depth, hit }: Drawable) => ({
  key,
  baseX,
  baseY,
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

it("keeps two separated reflection groups and lets light enter from one side of the basin", () => {
  const bounds = { x: 200, y: 90, width: 80, height: 48 }
  const before = [49, 110, 120] as const
  expect(pondReflection(0.264, 0.2, bounds)).toBeGreaterThan(0)
  expect(pondReflection(0.682, 0.538, bounds)).toBeGreaterThan(0)
  expect(pondReflection(0.288, 0.2, bounds)).toBe(0) // a break between strokes
  expect(pondReflection(0.31, 0.49, bounds)).toBe(0) // no repeating rows
  const at = (u: number, v: number, bank = 1) =>
    quietPondColor(bounds.x + u * bounds.width, bounds.y + v * bounds.height, bank, bounds, before)
  expect(at(0.59, 0.64, pondBankClearance)).toBe(before)
  expect(at(0.21, 0.3)[1]).toBeLessThan(at(0.74, 0.55)[1])
  expect(at(0.264, 0.2)[1]).toBeGreaterThan(at(0.288, 0.2)[1])
})

it("draws two floating leaf shapes without stamping over the immediate bank", () => {
  const bounds = { x: 284, y: 219, width: 80, height: 48 }
  const sample = (u: number, v: number, bank: number) =>
    quietPondColor(
      bounds.x + u * bounds.width,
      bounds.y + v * bounds.height,
      bank,
      bounds,
      [49, 110, 120],
    )
  const leaf = [88, 124, 67]
  expect(sample(0.379, 0.29, 0.8)).toEqual(leaf)
  expect(sample(0.398, 0.29, 0.8)).not.toEqual(leaf) // notch
  expect(sample(0.46, 0.329, 0.8)).toEqual(leaf)
  expect(sample(0.379, 0.29, 0.22)).not.toEqual(leaf)
})

it.each<[string, (seed: number, detailed?: boolean) => Sprite]>([
  ["forest-rim", rock],
  ["sea", seaRock],
])("refines %s rocks without moving their ground contact", (_, make) => {
  for (const seed of [0.2, 0.68]) {
    const old = make(seed, false)
    const next = make(seed, true)
    expect(next).toMatchObject({ anchorX: old.anchorX, anchorY: old.anchorY })
    expect(next.bitmap).toMatchObject({ width: old.bitmap.width, height: old.bitmap.height })
    if (make === rock) {
      const foot = 11 * old.bitmap.width
      expect(alpha(next.bitmap).slice(foot)).toEqual(alpha(old.bitmap).slice(foot))
      const topRow = (bitmap: Bitmap) => Math.floor(alpha(bitmap).findIndex(Boolean) / bitmap.width)
      expect(topRow(next.bitmap)).toBe(topRow(old.bitmap) + 2)
    } else {
      expect(alpha(next.bitmap)).toEqual(alpha(old.bitmap))
    }
    expect(next.bitmap.rgba).not.toEqual(old.bitmap.rgba)
  }
})

it("keeps every prop in the same place in the harbor preview", () => {
  const [plain, detailed] = [false, true].map((detailed) =>
    buildBayScene(bayTerrain([], "terracotta", detailed), "terracotta", 3, { view: "harbor" }),
  )
  expect(detailed!.drawables.map(anchor)).toEqual(plain!.drawables.map(anchor))
  // Mature trees intentionally use taller frames in Detailed mode, but other
  // props keep their full frame as well as their ground anchor.
  detailed!.drawables.forEach(({ treeArt, x, y, width, height }, index) => {
    if (!treeArt) expect(plain!.drawables[index]).toMatchObject({ x, y, width, height })
  })
})
