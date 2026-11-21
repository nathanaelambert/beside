import { bayFrame, bayTerrain, buildBayScene } from "./bayWorkshop"
import { rgb, type Bitmap } from "./bitmap"
import { islandPalettes, recolor } from "./islandPalettes"
import { paintGround, palette } from "./paint"
import { picnicClothRamp, readingBenchTexture, wovenBlanketColor } from "./picnicArt"
import { mapFrame } from "./projection"
import { buildHomeScene, hitTest, itemDrawable, opaqueAt, type Drawable } from "./scene"
import { tileMapFromRows } from "./tilemap"

function clothMask({ rgba }: Bitmap, colors: readonly string[]) {
  const tones = new Set(colors.map((c) => rgb(c).join(",")))
  const result: boolean[] = []
  for (let i = 0; i < rgba.length; i += 4)
    result.push(!!rgba[i + 3] && tones.has(rgba.subarray(i, i + 3).join(",")))
  return result
}

it("weaves across adjacent tiles without moving the blanket edge or changing regional colors", () => {
  // Isolate the cloth: Original art also uses a blanket accent for occasional grass petals.
  const map = tileMapFromRows(["....", ".bb.", ".bb.", "...."])
  const frame = mapFrame(map.cols, map.rows)
  const before = paintGround(map, frame)
  const detailed = paintGround({ ...map, art: "detailed" }, frame)
  const cloth = clothMask(detailed, picnicClothRamp)
  expect(cloth.filter(Boolean).length).toBeGreaterThan(500)
  expect(cloth).toEqual(clothMask(before, palette.blanket))
  expect(detailed.rgba).not.toEqual(before.rgba)
  for (const [variant, { swap }] of islandPalettes.entries()) {
    if (variant === 0) continue
    const mapped = picnicClothRamp.map((color) => swap[color]!)
    expect(mapped.every(Boolean)).toBe(true)
    expect(recolor(detailed, variant).rgba).not.toEqual(detailed.rgba)
    expect(clothMask(recolor(detailed, variant), mapped)).toEqual(cloth)
  }
})

it("alternates check color across neighboring tiles and only stitches where there is a hem", () => {
  const interior = wovenBlanketColor(0.14, 0.18, 1, 1, 0.07)
  expect(wovenBlanketColor(1.14, 0.18, 1, 1, 0.07)).not.toBe(interior)
  expect(wovenBlanketColor(0.14, 0.18, 0.01, 1, 0.07)).toBe(picnicClothRamp[0])
  expect(wovenBlanketColor(0.14, 0.18, 0.044, 1, 0.07)).toBe(picnicClothRamp[2])
})

const place = ({ key, depth, x, y, baseX, baseY, top, width, height, hit, shadow }: Drawable) => ({
  key,
  depth,
  x,
  y,
  baseX,
  baseY,
  top,
  width,
  height,
  hit,
  shadow,
})

it("shares the detailed bench in the garden and workshop, with an unchanged selection mask", () => {
  const id = "reading-bench"
  const old = itemDrawable(bayFrame, bayTerrain([], "terracotta"), "bench", id, 4.15, 7.5)!
  const map = bayTerrain([], "terracotta", true)
  const newBench = itemDrawable(bayFrame, map, "bench", id, 4.15, 7.5)!
  expect(place(newBench)).toEqual(place(old))
  expect(newBench.source).not.toEqual(old.source)
  expect(newBench.artAsset).toBe(readingBenchTexture)
  expect(old.artAsset).toBeUndefined()
  expect(newBench.artRows).toBeUndefined() // alpha and selection still come from the logical source
  for (let y = old.y; y < old.y + old.height; y++)
    for (let x = old.x; x < old.x + old.width; x++)
      expect(opaqueAt(newBench, x, y)).toBe(opaqueAt(old, x, y))
  expect(hitTest([newBench], newBench.baseX, newBench.baseY - 10, 22)).toEqual(old.hit)
  const home = buildHomeScene({
    avatars: [],
    items: [{ key: "placed", itemId: id, x: 104, y: 104 }],
  }).drawables.find((d) => d.key === "placed")!
  const sample = buildBayScene(map, "terracotta", 3, {
    view: "garden",
    sampleId: id,
  }).drawables.find((d) => d.key === "bay-sample")!
  expect(home.source).toEqual(newBench.source)
  expect(home.artAsset).toBe(readingBenchTexture)
  expect(sample.source).toEqual(newBench.source)
  expect(sample.artAsset).toBe(readingBenchTexture)
  expect(home.foliage).toBeUndefined()
})
